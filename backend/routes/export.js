

const express = require('express');
const auth = require('../middleware/auth'); // Adjust the path as needed
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const AdmZip = require('adm-zip');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const multer =  require('multer');
const upload = multer({ dest: 'uploads/' }); // temp storage for zip files
const mdIt = require('markdown-it')({ html: true, linkify: true, typographer: true });
const { stripFrontMatter, safePath } = require('../utils/fileUtils'); // Adjust the path as needed

const { DATA_ROOT } = require('../config/config');


const router = express.Router();

router.post('/upload', auth, upload.single('archive'), (req, res) => {
  let { targetFolder } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'No archive uploaded' });
  }

  try {
    // 🔥 strip username prefix if frontend includes it
    if (targetFolder && targetFolder.startsWith(req.user + '/')) {
      targetFolder = targetFolder.slice(req.user.length + 1);
    }

    const base = path.join(DATA_ROOT, req.user);
    const destDir = safePath(base, targetFolder || '.');
    mkdirp.sync(destDir);

    // Open uploaded zip
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const name = entry.entryName;
      const filename = path.basename(name);

      // 🚫 Skip any non-.md file
      if (!filename.endsWith('.md')) continue;

      // 🚫 Skip _toc.md
      if (filename.toLowerCase() === '_toc.md') continue;

      const relativePath = path.join(destDir, path.dirname(name));
      mkdirp.sync(relativePath);

      const fullPath = path.join(destDir, name);
      fs.writeFileSync(fullPath, entry.getData().toString('utf-8'));
    }

    // cleanup temp file
    fs.unlinkSync(req.file.path);

    res.json({ status: 'ok' });

  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // cleanup on error
    }
    res.status(400).json({ error: String(e) });
  }
});

async function renderMarkdownToPdfBuffer(mdContent) {
  const html = mdIt.render(mdContent);
  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
          h1,h2,h3,h4,h5,h6 { margin-top: 20px; font-weight: bold; }
          code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          blockquote { border-left: 4px solid #ccc; margin: 1em 0; padding-left: 10px; color: #555; }
          ul, ol { margin-left: 20px; }
          table { border-collapse: collapse; margin: 15px 0; width: 100%; }
          table, th, td { border: 1px solid #ddd; }
          th, td { padding: 8px; }
          a { color: blue; text-decoration: underline; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      //executablePath for docker with npx chormeium
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("PDF generation failed: empty buffer");
    }
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

// Helper: estimate total size & number of files
function estimateFolderSize(dir) {
  let totalSize = 0;
  let fileCount = 0;

  function walk(d) {
    const items = fs.readdirSync(d);
    for (const item of items) {
      const full = path.join(d, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && item.endsWith('.md') && item.toLowerCase() !== '_toc.md') {
        totalSize += stat.size;
        fileCount++;
      }
    }
  }

  walk(dir);
  return { totalSize, fileCount };
}

// Recursively collect .md files
function collectMdFiles(dir, relPath = '') {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectMdFiles(fullPath, path.join(relPath, item)));
    } else if (stat.isFile() && item.endsWith('.md') && item.toLowerCase() !== '_toc.md') {
      files.push({ fullPath, relPath, name: item.replace(/\.md$/, '.pdf') });
    }
  }
  return files;
}

// Full export endpoint
router.get('/export', auth, async (req, res) => {
  let { target, type } = req.query;
  if (!target) return res.status(400).json({ error: 'target required' });
  if (!type || type === 'undefined') type = 'zip';
  if(process.env.DEBUG) { console.log('Export', target, type); }

  try {
    if (target.startsWith(req.user + '/')) target = target.slice(req.user.length + 1);

    const base = path.join(DATA_ROOT, req.user);
    const full = safePath(base, target);

    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Target not found' });
    const stat = fs.statSync(full);

    // --- Single file PDF ---
    if (stat.isFile()) {
      if(process.env.DEBUG) { console.log('Single PDF'); }
      if (!target.endsWith('.md')) return res.status(400).json({ error: 'Only .md files can be exported' });

      let mdContent = fs.readFileSync(full, 'utf-8');
      mdContent = stripFrontMatter(mdContent);
      const pdfBuffer = await renderMarkdownToPdfBuffer(mdContent);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(target, '.md')}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    // --- Folder export (streaming ZIP) ---
    if (stat.isDirectory()) {
      const { totalSize, fileCount } = estimateFolderSize(full);

      if (fileCount > 50 || totalSize > 50 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Folder too large to generate download on-the-fly.',
          fileCount,
          estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        });
      }

      const mdFiles = collectMdFiles(full);
      if (mdFiles.length === 0) return res.status(400).json({ error: 'No Markdown files found in folder' });


      if (type === 'zip') {
        if(process.env.DEBUG) { console.log('ZIP'); }
        let fileList = [];

        fileList = collectMdFiles(full);

        // Heuristic limits
        const totalSize = fileList.reduce((sum, f) => sum + fs.statSync(f.fullPath).size, 0);
        if(process.env.DEBUG) { console.log(fileList); }
        if (fileList.length > 50 || totalSize > 50 * 1024 * 1024) {
          return res.status(400).json({
            error: 'Folder too large to generate ZIP. Consider downloading files individually.',
            fileCount: fileList.length,
            estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2)
          });
        }

        // Generate PDFs sequentially
        const zip = new AdmZip();
        for (const f of fileList) {
          try {
            let mdContent = fs.readFileSync(f.fullPath, 'utf-8');
            mdContent = stripFrontMatter(mdContent);
            const pdfBuffer = await renderMarkdownToPdfBuffer(mdContent);
            zip.addFile(
              path.join(f.relPath, f.name),
              pdfBuffer
            );
            if(process.env.DEBUG) { console.log('Added to ZIP:', path.join(f.relPath, f.name)); }
          } catch (err) {
            if(process.env.DEBUG) {  console.error(`Skipping file due to PDF error: ${f.fullPath}`, err); }
          }
        }

        const zipBuffer = zip.toBuffer();
        // 4) send zip to client with correct headers (important: .zip filename)
        res.setHeader('Content-Type', 'application/zip');
        // quote filename to be safe with spaces / unicode
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(target)}.zip"`);
        res.setHeader('Content-Length', zipBuffer.length);
        if(process.env.DEBUG) { console.log(res.getHeaders()); }
        // send and return
        return res.end(zipBuffer);


      }

      // --- Merge PDFs for folder ---
      if (type === 'pdf') {
        if(process.env.DEBUG) { console.log('PDF'); }
        const merged = await PDFDocument.create();
        for (let i = 0; i < mdFiles.length; i++) {
          try {
            let mdContent = fs.readFileSync(mdFiles[i].fullPath, 'utf-8');
            mdContent = stripFrontMatter(mdContent);
            const pdfBuffer = await renderMarkdownToPdfBuffer(mdContent);
            const src = await PDFDocument.load(pdfBuffer);
            const copiedPages = await merged.copyPages(src, src.getPageIndices());
            copiedPages.forEach(p => merged.addPage(p));
            if (i < mdFiles.length - 1) merged.addPage(); // page break
          } catch (err) {
            if(process.env.DEBUG) { console.error(`Skipping file in merged PDF due to error: ${mdFiles[i].fullPath}`, err); }
          }
        }
        const mergedPdf = await merged.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${path.basename(target)}.pdf`);
        return res.send(Buffer.from(mergedPdf));
      }

      return res.status(400).json({ error: 'Invalid type (must be zip or pdf)' });
    }

    return res.status(400).json({ error: 'Unsupported target type' });
  } catch (e) {
    if(process.env.DEBUG) { console.error("Export error:", e); }
    if (!res.headersSent) res.status(500).json({ error: 'Export failed', details: String(e) });
    else res.end();
  }
});

module.exports = router;