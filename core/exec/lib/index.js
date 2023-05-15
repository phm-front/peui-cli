'use strict';

const path = require('path');
const Package = require('@peui-cli/package');

// 命令与包的映射关系
const SETTINGS = {
  init: '@peui-cli/utils'
};

// 缓存dir
const CACHE_DIR = 'dependencies';

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;
  let pkg;
  const homePath = process.env.CLI_HOME_PATH;
  const command = arguments[arguments.length - 1];
  const packageName = SETTINGS[command.name()];
  const packageVersion = 'latest';
  if (!targetPath) {
    // 生成缓存路径
    targetPath = path.resolve(homePath, CACHE_DIR);
    const storeDir = path.resolve(targetPath, 'node_modules');
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    if (pkg.exist()) {
      // 更新package
      await pkg.update();
    } else {
      // 安装package
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootFilePath();
  require(rootFile).apply(null, arguments);
}
module.exports = exec;
