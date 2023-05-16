'use strict';

const Command = require('@peui-cli/command')

function init(argv) {
  return new InitCommand(argv)
}

class InitCommand extends Command {
  initialize() {
    
  }
  execute() {
    
  }
}

module.exports = init
module.exports.InitCommand = InitCommand;
