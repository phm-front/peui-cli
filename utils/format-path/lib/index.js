'use strict';

const path = require('path');

function formatPath(path) {
  if (!path) return null;
  // 1. 获取当前系统的分隔符
  const sep = path.sep;
  if (sep === '/') {
    return path;
  } else {
    return path.replace(/\\/g, '/');
  }
}

module.exports = formatPath;
