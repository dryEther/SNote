const express = require('express');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const { DATA_ROOT } = require('../config/config');
const { safePath } = require('../utils/fileUtils');
const { ensureUserDir } = require('../utils/userUtils');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/folders/create', auth, (req, res) => {
  const { folderPath, folderName } = req.body;
  console.log('Create folder', req.body);
  if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
  try {
    console.log(req.user, folderPath, folderName);
    const full = safePath(path.join(DATA_ROOT, req.user), folderPath.startsWith(req.user + '/') ? folderPath.slice(req.user.length + 1) : folderPath);
    console.log('Creating folder', full);
    if (fs.existsSync(full)) return res.status(400).json({ error: 'Folder exists' });
    mkdirp.sync(full);
    res.json({ status: 'ok' });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

router.post('/rename', auth, (req, res) => {
  let { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    return res.status(400).json({ error: 'oldPath/newPath required' });
  }

  try {

    if (oldPath.startsWith(req.user + '/')) {
      oldPath = oldPath.slice(req.user.length + 1);
    }
    if (newPath.startsWith(req.user + '/')) {
      newPath = newPath.slice(req.user.length + 1);
    }

    const fullOld = safePath(path.join(DATA_ROOT, req.user), oldPath);
    const fullNew = safePath(path.join(DATA_ROOT, req.user), newPath);

    if (!fs.existsSync(fullOld)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stat = fs.statSync(fullOld);

    // --- File rename rules ---
    if (stat.isFile()) {
      if (!oldPath.endsWith('.md')) {
        return res.status(400).json({ error: 'Only .md files can be renamed' });
      }
      if (!newPath.endsWith('.md')) {
        return res.status(400).json({ error: 'New name must also end with .md' });
      }
    }

    // --- Folder rename (no extension restriction) ---
    if (stat.isDirectory()) {
      if (newPath.endsWith('.md')) {
        return res.status(400).json({ error: 'Folder cannot be renamed to .md file' });
      }
    }

    mkdirp.sync(path.dirname(fullNew));
    fs.renameSync(fullOld, fullNew);

    res.json({ status: 'ok' });

  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

router.post('/delete', auth, (req, res) => {
  let { target } = req.body;
  if (!target) return res.status(400).json({ error: 'target required' });
  try {
    if (target.startsWith(req.user + '/')) target = target.slice(req.user.length + 1);
    const base = path.join(DATA_ROOT, req.user);
    const full = safePath(base, target);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Path not found' });
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      if (!target.endsWith('.md')) return res.status(400).json({ error: 'Only .md files can be deleted' });
      fs.unlinkSync(full);
    } else if (stat.isDirectory()) {
      rimraf.sync(full);
    }
    res.json({ status: 'ok' });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

router.post('/move', auth, (req, res) => {
  let { source, destination } = req.body;
  if (!source || !destination) {
    return res.status(400).json({ error: 'source/destination required' });
  }
  else if (process.env.DEBUG) {
    console.log('Move', source, '→', destination);
  }

  try {
    // 🔥 strip username prefix if frontend sends it
    if (source.startsWith(req.user + '/')) {
      source = source.slice(req.user.length + 1);
    }
    if (destination.startsWith(req.user + '/')) {
      destination = destination.slice(req.user.length + 1);
    }

    const base = path.join(DATA_ROOT, req.user);
    const fullSrc = safePath(base, source);
    const fullDst = safePath(base, destination);

    if (process.env.DEBUG) {
      console.log('Base paths:', base);
      console.log('Full paths:', fullSrc, '→', fullDst);
    }

    if (!fs.existsSync(fullSrc)) {
      return res.status(404).json({ error: 'Source not found' });
    }

    const stat = fs.statSync(fullSrc);

    if (stat.isFile()) {
      // ✅ Only allow moving .md files
      if (!source.endsWith('.md')) {
        return res.status(400).json({ error: 'Only .md files can be moved' });
      }
      mkdirp.sync(path.dirname(fullDst));
      fs.renameSync(fullSrc, fullDst);
    } else if (stat.isDirectory()) {
      // ✅ Prevent moving a folder inside itself
      if (fullDst.startsWith(fullSrc)) {
        return res.status(400).json({ error: 'Cannot move folder into its own subfolder' });
      }
      mkdirp.sync(path.dirname(fullDst));
      fs.renameSync(fullSrc, fullDst);
    } else {
      return res.status(400).json({ error: 'Unsupported path type' });
    }

    res.json({ status: 'ok' });

  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

module.exports = router;
