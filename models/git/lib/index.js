'use strict';

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const Github = require('./github.js');
const Gitee = require('./gitee.js');
const ora = require('ora');
const log = require('@peui-cli/log')
const { readFile, writeFile } = require('@peui-cli/utils');

const GIT_ROOT_DIR = '.git';
const GIT_SERVER_FILE = '.git_server';
const GIT_TOKEN_FILE = '.git_token';
const GITHUB = 'github';
const GITEE = 'gitee';

const GIT_SERVER_CHOICES = [
  { name: 'Github', value: GITHUB },
  { name: 'Gitee', value: GITEE },
];

class Git {
  constructor({ name, version, dir }, options) {
    this.name = name;
    this.version = version;
    this.dir = dir;
    // 创建simple-git对象
    this.git = simpleGit(dir);
    this.gitServer = null;
    this.token = null;
    this.user = null;
    this.orgs = null;
    // 缓存目录
    this.homePath = process.env.CLI_HOME_PATH;
    this.options = options;
  }
  async prepare() {
    // 检查用户远程仓库类型
    await this.checkGitServer();
    // 获取远程仓库token
    await this.checkGitToken();
    // 获取用户和组织信息
    await this.getUserAndOrgs();
  }
  // 检查用户远程仓库类型 初始化gitServer
  async checkGitServer() {
    const gitServerPath = this.createPath(GIT_SERVER_FILE);
    let gitServerType = readFile(gitServerPath);
    // 重新选择或者没有gitServer文件
    if (this.options.rechoiceServer || !gitServerType) {
      gitServerType = (await inquirer.prompt([
        {
          type: 'list',
          name: 'gitServerType',
          message: '请选择托管的Git平台',
          default: GITHUB,
          choices: GIT_SERVER_CHOICES,
        },
      ])).gitServerType;
      writeFile(gitServerPath, gitServerType);
      log.success('gitServer写入成功', `${gitServerType} -> ${gitServerPath}`)
    } else {
      log.success('gitServer读取成功', gitServerType)
    }
    this.gitServer = this.createGitServer(gitServerType);
    if (!this.gitServer) {
      throw new Error('git server初始化失败！')
    }
  }
  // 获取远程仓库token
  async checkGitToken() {
    const gitTokenPath = this.createPath(GIT_TOKEN_FILE);
    let gitToken = readFile(gitTokenPath);
    if (this.options.rewriteToken || !gitToken) {
      log.warn(
        this.options.rewriteToken ?
        '重新录入token' :
        `${this.gitServer.type} token未生成，请先生成token：${this.gitServer.helpUrl}`
      )
      gitToken = (await inquirer.prompt({
        type: 'password',
        name: 'token',
        message: '请录入token',
        default: '',
      })).token;
      writeFile(gitTokenPath, gitToken);
      log.success('token写入成功')
    } else {
      // ffa4fcb23fe692782675736c4ccacb83
      log.success('token读取成功')
    }
    this.token = gitToken;
    this.gitServer.setToken(gitToken);
  }
  // 获取用户和组织信息
  async getUserAndOrgs() {
    const userSpiner = ora('获取用户信息...').start();
    try {
      this.user = await this.gitServer.getUser();
    } catch (error) {
      throw error
    } finally {
      userSpiner.stop()
      if (!this.user) {
        throw new Error('用户信息获取失败！')
      }
    }
    log.success(this.gitServer.type + ' 用户信息获取成功')
    const orgsSpiner = ora('获取组织信息...').start();
    try {
      this.orgs = await this.gitServer.getOrg(this.user.login);
    } catch (error) {
      throw error
    } finally {
      orgsSpiner.stop()
      if (!this.orgs) {
        throw new Error('组织信息获取失败！')
      }
    }
    log.success(this.gitServer.type + ' 组织信息获取成功')
  }
  // 创建.git文件夹 返回file对应路径
  createPath(file) {
    const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR);
    const filePath = path.resolve(rootDir, file);
    fs.ensureDirSync(rootDir);
    return filePath;
  }
  // 创建gitServer对象
  createGitServer(type) {
    if (type === GITHUB) {
      return new Github()
    } else if(type === GITEE) {
      return new Gitee()
    } else {
      return null
    }
  }
  init() {
    console.log('git init');
  }
}

module.exports = Git;
