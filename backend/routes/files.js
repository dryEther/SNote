const express = require('express');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const auth = require('../middleware/auth');
const { DATA_ROOT } = require('../config/config');
const { safePath } = require('../utils/fileUtils');

const router = express.Router();

router.post('/create', auth, (req, res) => {
  const { filePath, fileName, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  try {
    if (process.env.DEBUG) { console.log(req.user, filePath, fileName); }
    const full = safePath(path.join(DATA_ROOT, req.user), 
                          filePath.startsWith(req.user + '/') ? filePath.slice(req.user.length + 1) : filePath);
    if (process.env.DEBUG) { console.log(full); }
    if (fs.existsSync(full)) return res.status(400).json({ error: 'File exists' });
    mkdirp.sync(path.dirname(full));
    fs.writeFileSync(full, content || '');
    res.json({ status: 'ok' });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

router.post('/update', auth, (req, res) => {
  let { fileName, content } = req.body;
  if (!fileName) return res.status(400).json({ error: 'fileName required' });

  try {
    if (process.env.DEBUG) { console.log(req.user, fileName); }
    if (fileName.startsWith(req.user + '/')) fileName = fileName.slice(req.user.length + 1);
    const full = safePath(path.join(DATA_ROOT, req.user), fileName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    if (!fileName.endsWith('.md')) return res.status(400).json({ error: 'Only .md files can be updated' });
    fs.writeFileSync(full, content || '', 'utf-8');
    res.json({ status: 'ok' });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

module.exports = router;
