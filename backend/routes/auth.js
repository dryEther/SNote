const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getUserFile, ensureUserDir } = require('../utils/userUtils');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username/password required' });
  const userPath = getUserFile(username);
  if (fs.existsSync(userPath)) return res.status(400).json({ error: 'User exists' });
  ensureUserDir(username);
  const hash = bcrypt.hashSync(password, 10);
  fs.writeFileSync(userPath, JSON.stringify({ username, passwordHash: hash, activeToken: null }, null, 2));
  res.json({ status: 'ok' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const userPath = getUserFile(username);
  console.log('Login attempt', username, userPath );
  try{
  if (!fs.existsSync(userPath)) return res.status(400).json({ error: 'User not found' });
  const user = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
  console.log('User data', user);
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid' });

  const token = jwt.sign({ username }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.TOKEN_EXPIRY || '2h' });
  user.activeToken = token;
  console.log('Generated token');
  fs.writeFileSync(userPath, JSON.stringify(user, null, 2));

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 2 * 60 * 60 * 1000
  });
  res.json({ status: 'ok' });
  } catch (e) {
    console.log(e.massage);
    console.log(userPath, user, token, res.cookie);
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const userPath = getUserFile(payload.username);
    if (fs.existsSync(userPath)) {
      const user = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
      if (user.activeToken === token) {
        user.activeToken = null;
        fs.writeFileSync(userPath, JSON.stringify(user, null, 2));
      }
    }
  } catch (e) {
    const payload = jwt.decode(token);
    if (payload?.username) {
      const userPath = getUserFile(payload.username);
      if (fs.existsSync(userPath)) {
        const user = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
        if (user.activeToken === token) {
          user.activeToken = null;
          fs.writeFileSync(userPath, JSON.stringify(user, null, 2));
        }
      }
    }
  }

  res.clearCookie('auth_token');
  res.json({ status: 'ok' });
});

module.exports = router;
