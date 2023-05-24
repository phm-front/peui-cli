'use strict';

const cp = require('child_process');

function isObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

// 兼容windows
function spawnPro(command, args, options = {}) {
  const win32 = process.platform === 'win32';
  const cmd = win32 ? 'cmd' : command;
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;
  return cp.spawn(cmd, cmdArgs, options);
}
// promise封装spawn
function spawnAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnPro(command, args, options)
    child.on('error', err => {
      reject(err);
    })
    child.on('exit', code => {
      resolve(code);
    })
  });
}

module.exports = {
  isObject,
  spawnPro,
  spawnAsync
};
