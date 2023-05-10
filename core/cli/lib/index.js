'use strict';

const path = require('path');
const semver = require('semver');
const colors = require('colors/safe');
const userHome = require('user-home');
console.log(userHome)

const log = require('@peui-cli/log');

const constant = require('../const/index');
const pkg = require('../package.json');

module.exports = main;

async function main() {
  try {
    // 检查版本号
    checkPkgVersion()
    // 检查node版本
    checkNodeVersion()
    // 检查root
    checkRoot()
    // 检查用户主目录
    await checkUserHome()
    // 检查入参
    checkInputArgs()
    // 检查环境变量
    await checkEnv()
  } catch (error) {
    log.error(error.message)
  }
}

// 检查环境变量 环境变量可以在userHome/.env中配置
async function checkEnv() {
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(userHome, '.env')
  const { pathExistsSync } = await import('path-exists')
  if (pathExistsSync(dotenvPath)) {
    // 注入环境变量
    dotenv.config({
      path: dotenvPath
    })
  }
  // 注入CLI_HOME_PATH
  // 如果用户主目录下的.env文件配置了CLI_HOME则使用配置的CLI_HOME
  // 否则使用默认的DEFAULT_CLI_HOME
  createDefaultConfig()
  log.verbose('环境变量', process.env.CLI_HOME_PATH)
}
// 注入CLI_HOME_PATH
function createDefaultConfig() {
  let cliHome
  if (process.env.CLI_HOME) {
    cliHome = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliHome = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliHome
}

// 检查入参
function checkInputArgs() {
  const minimist = require('minimist')
  const args = minimist(process.argv.slice(2))
  checkArgs(args)
}

function checkArgs(args) {
  if (args.debug) {
    process.env.LOG_LEVEL = 'verbose'
  } else {
    process.env.LOG_LEVEL = 'info'
  }
  log.level = process.env.LOG_LEVEL
}

// 检查用户主目录
async function checkUserHome() {
  const { pathExistsSync } = await import('path-exists')
  try {
    if (!userHome || !pathExistsSync(userHome)) {
      throw new Error(colors.red('当前登录用户主目录不存在！'))
    }
  } catch (error) {
    log.error(error.message)
  }
}

// 检查root root降级
function checkRoot() {
  // root-check使用了es module, 所以这里需要使用动态import导入
  import('root-check').then(({ default: rootCheck }) => {
    rootCheck()
  })
}

// 检查node版本
function checkNodeVersion() {
  // 获取当前node版本号
  const currentVersion = process.version
  // 获取最低版本号
  const lowestVersion = pkg.engines.node.replace('>=', '')
  // 比较版本号
  if (!semver.gte(currentVersion, lowestVersion)) {
    throw new Error(colors.red(`peui-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`))
  }
}

// 检查脚手架版本
function checkPkgVersion() {
  log.notice('当前cli版本:', pkg.version)
}

