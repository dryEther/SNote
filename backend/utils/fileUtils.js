const fs = require('fs');
const path = require('path');

function safePath(base, target) {
  const p = path.resolve(base, target);
  if(process.env.DEBUG) { console.log(p, base, target); }
  if (!p.startsWith(base)) throw new Error('Invalid path');
  return p;
}

function listTree(baseDir) {
  const stat = fs.statSync(baseDir);
  if (stat.isFile()) return { type: 'file', name: path.basename(baseDir) };
  const res = { type: 'folder', name: path.basename(baseDir), children: [] };
  const items = fs.readdirSync(baseDir);
  for (const it of items) {
    const full = path.join(baseDir, it);
    const s = fs.statSync(full);
    if (s.isDirectory()) res.children.push(listTree(full));
    else res.children.push({ type: 'file', name: it });
  }
  if(process.env.DEBUG) { console.log('Tree:', res);}
  return res;
}

function stripFrontMatter(mdContent) {
  // Match YAML front matter between leading ---
  return mdContent.replace(/^---[\s\S]*?---\s*/, '');
}

module.exports = { safePath, listTree, stripFrontMatter };
