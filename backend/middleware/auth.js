const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getUserFile } = require('../utils/userUtils');

function auth(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const userPath = getUserFile(payload.username);
    if (!fs.existsSync(userPath)) return res.status(401).json({ error: 'User not found' });

    const user = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
    if (user.activeToken !== token) return res.status(403).json({ error: 'Session invalid' });

    req.user = payload.username;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = auth;
