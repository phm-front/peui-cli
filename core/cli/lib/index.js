'use strict';

const { execSync } = require('child_process');
const path = require('path');
const semver = require('semver');
const colors = require('colors/safe');
const userHome = require('user-home');
const { sync } = require('path-exists');
const commander = require('commander');

const log = require('@peui-cli/log');

const constant = require('../const/index');
const pkg = require('../package.json');
const exec = require('@peui-cli/exec');

const program = new commander.Command();

module.exports = main;

function main() {
  try {
    // 脚手架启动阶段检查
    prepare();
    // 注册command脚手架
    registerCommand();
  } catch (error) {
    log.error(error.message);
    if (program.opts().debug) {
      console.log(error);
    }
  }
}

// 脚手架启动阶段检查
function prepare() {
  // 检查版本号
  checkPkgVersion();
  // 检查root
  checkRoot();
  // 检查用户主目录
  checkUserHome();
  // 检查环境变量
  checkEnv();
  // 检查脚手架是否需要升级
  // checkGlobalUpdate();
}

function registerCommand() {
  program
    .name('peui')
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --target-path <target-path>', '是否指定本地调试文件路径', '');
  // 注册init命令
  program
    .command('init <projectName>')
    .description('初始化项目')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec);
  // 处理debug模式
  program.on('option:debug', function () {
    if (program.opts().debug) {
      process.env.LOG_LEVEL = 'verbose';
    } else {
      process.env.LOG_LEVEL = 'info';
    }
    log.level = process.env.LOG_LEVEL;
  });
  // 处理targetPath 设置环境变量
  program.on('option:target-path', function (val) {
    process.env.CLI_TARGET_PATH = val;
  });
  // 未知命令监听
  program.on('command:*', function (obj) {
    const availableCommands = program.commands.map((cmd) => cmd.name());
    log.error(colors.red('未知的命令：' + obj[0]));
    if (availableCommands.length) {
      log.info(colors.green('可用命令：' + availableCommands.join(',')));
    }
  });
  // 参数解析
  program.parse(process.argv);
  // 未输入命令处理
  if (program.args && program.args.length < 1) {
    program.outputHelp();
  }
}

// 检查脚手架是否需要升级
function checkGlobalUpdate() {
  // 获取当前版本号
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  // 获取npm模块最新版本号
  const latestVersion = execSync(`npm view ${npmName} version`).toString();
  if (latestVersion && semver.gt(latestVersion, currentVersion)) {
    log.warn(
      colors.yellow(
        `请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${latestVersion}
          更新命令：npm install -g ${npmName}`
      )
    );
  }
}

// 检查环境变量 环境变量可以在userHome/.env中配置
function checkEnv() {
  const dotenv = require('dotenv');
  const dotenvPath = path.resolve(userHome, '.env');
  if (sync(dotenvPath)) {
    // 注入环境变量
    dotenv.config({
      path: dotenvPath,
    });
  }
  // 注入CLI_HOME_PATH
  // 如果用户主目录下的.env文件配置了CLI_HOME则使用配置的CLI_HOME
  // 否则使用默认的DEFAULT_CLI_HOME
  createDefaultConfig();
}
// 注入CLI_HOME_PATH
function createDefaultConfig() {
  let cliHome;
  if (process.env.CLI_HOME) {
    cliHome = path.join(userHome, process.env.CLI_HOME);
  } else {
    cliHome = path.join(userHome, constant.DEFAULT_CLI_HOME);
  }
  process.env.CLI_HOME_PATH = cliHome;
}

// 检查用户主目录
function checkUserHome() {
  if (!userHome || !sync(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在！'));
  }
}

// 检查root root降级
function checkRoot() {
  // root-check使用了es module, 所以这里需要使用动态import导入
  import('root-check').then(({ default: rootCheck }) => {
    rootCheck();
  });
}

// 检查脚手架版本
function checkPkgVersion() {
  log.notice('当前cli版本:', pkg.version);
}
