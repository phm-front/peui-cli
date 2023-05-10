'use strict';

const npmlog = require('npmlog')
npmlog.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info'
// 前缀
// npmlog.heading = 'peui-cli'
// 自定义log 默认level为info 等级为2000 所以自定义的level要大于2000
npmlog.addLevel('success', 2001, { fg: 'green', bold: true })

module.exports = npmlog;
