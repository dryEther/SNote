const express = require('express');
const fs = require('fs');
const path = require('path');
const { DATA_ROOT } = require('../config/config');
const { safePath, listTree } = require('../utils/fileUtils');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/tree', auth, (req, res) => {
  try {
    const root = path.join(DATA_ROOT, req.user);
    if (!fs.existsSync(root)) return res.json({ type: 'folder', name: req.user, children: [] });
    const tree = listTree(root);
    res.json(tree);
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

router.get('/folder/list', auth, (req, res) => {
  const folder = req.query.folder || '.';
  try {
    const full = safePath(path.join(DATA_ROOT, req.user), folder);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Folder not found' });
    const items = fs.readdirSync(full).map(name => {
      const s = fs.statSync(path.join(full, name));
      return { name, type: s.isDirectory() ? 'folder' : 'file' };
    });
    res.json({ path: folder, items });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

module.exports = router;
