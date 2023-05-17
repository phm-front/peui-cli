'use strict';

const semver = require('semver');
const colors = require('colors/safe');
const log = require('@peui-cli/log');

// 最低node版本
const MIN_NODE_VERSION = '14.0.0';

class Command {
  constructor(argv) {
    if (!argv) {
      throw new Error(`初始化${this.constructor.name}参数不能为空！`);
    }
    if (!Array.isArray(argv)) {
      throw new Error(`初始化${this.constructor.name}参数必须为数组！`);
    }
    if (!argv.length) {
      throw new Error(`初始化${this.constructor.name}参数不能为空数组！`);
    }
    this._argv = argv;
    const runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.initialize());
      chain = chain.then(() => this.execute());
      chain.catch((err) => {
        log.error(err.message);
      });
    });
  }
  // 检查node版本
  checkNodeVersion() {
    // 获取当前node版本号
    const currentVersion = process.version;
    // 比较版本号
    if (!semver.gte(currentVersion, MIN_NODE_VERSION)) {
      throw new Error(
        colors.red(`peui-cli 需要安装 v${MIN_NODE_VERSION} 以上版本的 Node.js`)
      );
    }
  }
  // 初始化参数
  initArgs() {
    // 获取参数
    this._cmd = this._argv[this._argv.length - 1];
    this._options = this._argv[this._argv.length - 2];
    this._argv = this._argv.slice(0, this._argv.length - 2);
  }
  initialize() {
    // 使用constructor.name获取子类类名
    throw new Error(this.constructor.name + '必须实现initialize方法');
  }
  execute() {
    throw new Error(this.constructor.name + '必须实现execute方法');
  }
}

module.exports = Command;
