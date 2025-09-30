const path = require('path');
const fs = require('fs');

const DATA_ROOT = path.resolve(process.env.DATA_ROOT || './Data');
if (!fs.existsSync(DATA_ROOT)) fs.mkdirSync(DATA_ROOT, { recursive: true });

const USERS_ROOT = path.resolve(process.env.USERS_ROOT || './Users');
if (!fs.existsSync(USERS_ROOT)) fs.mkdirSync(USERS_ROOT, { recursive: true });

module.exports = { DATA_ROOT, USERS_ROOT };
