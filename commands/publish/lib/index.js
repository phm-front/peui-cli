'use strict';

const Command = require('@peui-cli/command');
const Git = require('@peui-cli/git');
const log = require('@peui-cli/log');
const fs = require('fs-extra')

function publish(argv) {
  return new PublishCommand(argv);
}

class PublishCommand extends Command {
  initialize() {
    console.log('publishCommand initialize');
  }
  async execute() {
    try {
      const startTime = new Date().getTime();
      // 1. 初始化检查
      await this.prepare();
      // 2. git flow
      const git = new Git(this.projectInfo, this._options);
      await git.prepare();
      git.init();
      // 3. 云构建和云发布
      const endTime = new Date().getTime();
      log.info('发布用时：', Math.floor((endTime - startTime) / 1000) + '秒');
    } catch (error) {
      log.error(error.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(error);
      }
    }
  }
  async prepare() {
    // 1.确认项目是否是npm项目
    const processPath = process.cwd();
    const pkgPath = `${processPath}/package.json`;
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json文件不存在！');
    }
    // 2.确认是否包含build命令
    const pkg = fs.readJSONSync(pkgPath);
    const { name, version, scripts } = pkg;
    if (!name || ! version || !scripts || !scripts.build) {
      throw new Error('package.json信息不全！必须包含name、version、scripts.build字段！');
    }
    this.projectInfo = { name, version, dir: processPath };
  }
}

module.exports = publish;
module.exports.PublishCommand = PublishCommand;
