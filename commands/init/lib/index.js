'use strict';

const Command = require('@peui-cli/command')
const log = require('@peui-cli/log')

function init(argv) {
  return new InitCommand(argv)
}

class InitCommand extends Command {
  // 初始化
  initialize() {
    this.projectName = this._argv[0];
    this.force = this._options.force;
    // debug信息
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  // 执行命令
  execute() {
    
  }
}

module.exports = init
module.exports.InitCommand = InitCommand;
