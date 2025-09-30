const express = require('express');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const auth = require('../middleware/auth');
const { DATA_ROOT } = require('../config/config');
const { safePath } = require('../utils/fileUtils');

const router = express.Router();

router.get('/folder', auth, (req, res) => {
  let folderPath = req.query.path;
  if (!folderPath) return res.status(400).json({ error: 'folderName required' });
  try {
    if(process.env.DEBUG) { console.log('ZIP Archive download requested :', folderPath); }
    if (folderPath.startsWith(req.user + '/')) {
      folderPath = folderPath.slice(req.user.length + 1);
    }
    const full = safePath(path.join(DATA_ROOT, req.user), folderPath);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Folder not found' });
    const zip = new AdmZip();
    zip.addLocalFolder(full, path.basename(folderPath));
    const data = zip.toBuffer();
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename=${path.basename(folderPath)}.zip`);
    res.send(data);
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

router.get('/file', auth, (req, res) => {
  const fileName = req.query.path;
  if (!fileName) return res.status(400).json({ error: 'fileName required' });
  try {
    if(process.env.DEBUG) { console.log('File download requested :', fileName); }
    const full = safePath(DATA_ROOT, fileName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    res.download(full);
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

module.exports = router;
