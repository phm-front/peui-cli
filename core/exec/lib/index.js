'use strict';

const path = require('path');

const Package = require('@peui-cli/package');
const log = require('@peui-cli/log');
const { spawnPro } = require('@peui-cli/utils');

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
  // 获取入口文件
  const entryFile = pkg.getEntryFilePath();
  if (!entryFile) return log.error('指定包的入口文件不存在');
  // 执行入口文件
  try {
    // 使用多进程执行
    // require(entryFile).call(null, Array.from(arguments));
    const argv = Array.from(arguments)
    const cmd = argv[argv.length - 1];
    // 创建一个新的对象替换cmd 减少一些cmd上不必要的属性
    const o = Object.create(null);
    Object.keys(cmd).forEach(key => {
      if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
        o[key] = cmd[key]
      }
    })
    argv[argv.length - 1] = o;
    const code = `require('${entryFile}').call(null, ${JSON.stringify(argv)})`;
    const child = spawnPro('node', ['-e', code], {
      cwd: process.cwd(),
      // inherit 表示将父进程的输入输出流传递给子进程
      // 所以不用使用subprocess.stdout的方式来监听子进程的输出/错误等
      stdio: 'inherit'
    })
    // 监听错误
    child.on('error', err => {
      log.error(err.message);
      // 退出进程 1表示异常退出 0表示正常退出
      process.exit(1);
    })
    // 监听完成退出
    child.on('exit', e => {
      log.verbose('命令执行成功' + e);
      process.exit(e);
    })
  } catch (error) {
    log.error(error.message);
  }
}

module.exports = exec;
