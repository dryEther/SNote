const path = require('path');
const mkdirp = require('mkdirp');
const { USERS_ROOT, DATA_ROOT } = require('../config/config');

function getUserFile(username) {
  console.log('Getting user file for', username);
  return path.join(USERS_ROOT, `${username}.json`);
}

function ensureUserDir(username) {
  mkdirp.sync(path.join(DATA_ROOT, username));
}

module.exports = { getUserFile, ensureUserDir };
