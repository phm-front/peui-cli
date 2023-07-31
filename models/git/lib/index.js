'use strict';

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const Github = require('./github.js');
const Gitee = require('./gitee.js');
const ora = require('ora');
const semver = require('semver');
const log = require('@peui-cli/log')
const { readFile, writeFile } = require('@peui-cli/utils');

const GIT_ROOT_DIR = '.git';
const GIT_SERVER_FILE = '.git_server'; // 存储git服务器类型 github/gitee
const GIT_TOKEN_FILE = '.git_token'; // 存储对应git服务器token
const GIT_OWN_FILE = '.git_own'; // 存储仓库类型 user/org 个人/组织
const GIT_LOGIN_FILE = '.git_login'; // 存储登录名

const GITHUB = 'github';
const GITEE = 'gitee';
const PERSONAL = 'user';
const ORGANIZATION = 'org';

const VERSION_RELEASE = 'release';
const VERSION_DEV = 'dev';

const GIT_SERVER_CHOICES = [
  { name: 'Github', value: GITHUB },
  { name: 'Gitee', value: GITEE },
];
const GIT_OWNER_CHIOICES = [
  { name: '个人', value: PERSONAL },
  { name: '组织', value: ORGANIZATION },
];
const GIT_OWNER_ONE = [
  { name: '个人', value: PERSONAL },
]

class Git {
  constructor({ name, version, dir }, options) {
    this.name = name;
    this.version = version;
    this.dir = dir; // process.cwd()
    // 创建simple-git对象
    this.git = simpleGit(dir);
    this.gitServer = null; // gitServer对象
    this.token = null; // 仓库token
    this.user = null; // 用户信息
    this.orgs = null; // 组织列表
    this.owner = null; // 仓库类型
    this.login = null; // 仓库用户登录名
    this.repo = null; // 仓库信息
    this.branch = null; // 本地分支
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
    // 确认远程仓库类型
    await this.checkGitOwner();
    // 检查并创建远程仓库
    await this.checkGitRepo();
    // 检查gitignore文件
    this.checkGitIgnore();
    // 本地仓库初始化
    if (!fs.existsSync(path.resolve(this.dir, '.git'))) {
      await this.init();
    }
  }
  // 代码提交
  async commit() {
    // 1、生成开发分支版本号
    await this.getCorrectVersion();
    // 2、切换分支前检查是否有未提交的代码
    await this.checkUncommit();
    // 3、切换开发分支
    await this.checkoutBranch(this.branch);
    // 4、合并远程master分支和开发分支代码
    await this.pullRemoteMasterAndBranch();
    // 5、修改package.json版本号 commit代码
    this.updatePackageJsonVersion(this.version);
    await this.checkUncommit();
    // 6、推送代码到远程开发分支
    await this.pushBrach(this.branch);
  }
  // 生成开发分支 major/minor/patch
  async getCorrectVersion() {
    // 获取远程发布分支 release/x.x.x
    log.info('获取远程分支');
    const branchList = await this.getRemoteBranchList(VERSION_RELEASE);
    log.info('release branch list：', branchList);
    let releaseVersion;
    if (branchList.length) {
      releaseVersion = branchList[0];
    }
    log.verbose('线上最新版本号', releaseVersion || '无');
    // 生成本地开发分支
    const devVersion = this.version;
    if (!releaseVersion) {
      // 如果没有线上版本号 本地分支为dev/this.version
      this.branch = `${VERSION_DEV}/${devVersion}`;
    } else if (semver.gt(devVersion, releaseVersion)) {
      log.info('本地版本号大于线上版本号');
      this.branch = `${VERSION_DEV}/${devVersion}`;
    } else {
      // 如果本地版本号小于线上版本号 则让用户选择升级版本号 major/minor/patch
      log.info('本地版本号小于等于线上版本号');
      const incType = (await inquirer.prompt({
        type: 'list',
        name: 'incType',
        message: '请选择升级版本类型',
        default: 'patch',
        choices: [
          { name: `补丁版本：${releaseVersion} -> ${semver.inc(releaseVersion, 'patch')}`, value: 'patch' },
          { name: `小版本：${releaseVersion} -> ${semver.inc(releaseVersion, 'minor')}`, value: 'minor' },
          { name: `大版本：${releaseVersion} -> ${semver.inc(releaseVersion, 'major')}`, value: 'major' },
        ],
      })).incType;
      const incVersion = semver.inc(releaseVersion, incType);
      this.branch = `${VERSION_DEV}/${incVersion}`;
      this.version = incVersion;
      // 更新package.json版本号
      // this.updatePackageJsonVersion(this.version);
    }
  }
  async checkoutBranch(branch) {
    // 获取所有本地分支
    const localBranchList = await this.git.branchLocal();
    if (localBranchList.all.includes(branch)) {
      // 本地分支存在
      await this.git.checkout(branch);
      log.success(`切换到本地分支${branch}`);
    } else {
      // 本地分支不存在
      await this.git.checkoutBranch(branch, 'master');
      log.success(`创建并切换到本地分支${branch}`);
    }
  }
  // 合并远程master分支和开发分支代码
  async pullRemoteMasterAndBranch() {
    log.info(`合并远程 [master] -> [${this.branch}]`);
    await this.pullRemoteBranch('master');
    log.success('合并master分支代码成功');
    // 检查代码冲突
    await this.checkConflicts()
    log.info('检查远程开发分支')
    const remoteBranchList = await this.getRemoteBranchList(VERSION_DEV);
    console.log('remoteBranchList', remoteBranchList)
    if (remoteBranchList.includes(this.version)) {
      // 存在远程开发分支 拉取代码
      log.info(`合并远程 [${this.branch}] -> [${this.branch}]`);
      await this.pullRemoteBranch(this.branch);
      log.success(`合并远程${this.branch}分支代码成功`);
      await this.checkConflicts()
    } else {
      log.success(`远程不存在${this.branch}分支`)
    }
  }
  // 获取远程分支列表
  async getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(['--refs']);
    let reg;
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g;
    } else {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g;
    }
    const result = [];
    remoteList.split('\n').forEach(item => {
      const match = reg.exec(item);
      reg.lastIndex = 0;
      if (match && semver.valid(match[1])) {
        result.push(match[1]);
      }
    });
    return result.sort((a, b) => {
      // 排序 版本号大的在前面
      return semver.gt(a, b) ? -1 : 1;
    });
  }
  // 更新package.json版本号
  updatePackageJsonVersion(version) {
    const pkgPath = path.resolve(this.dir, 'package.json');
    const pkg = fs.readJSONSync(pkgPath);
    // 版本号不同才更新
    if (pkg.version !== version) {
      pkg.version = version;
      fs.writeJSONSync(pkgPath, pkg, { spaces: 2 });
      log.success('package.json版本号更新成功', version);
    }
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
      // gitee ffa4fcb23fe692782675736c4ccacb83
      // github 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
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
      log.verbose('getUser error', error)
      throw new Error('用户信息获取失败！')
    } finally {
      userSpiner.stop()
    }
    log.success(this.gitServer.type + ' 用户信息获取成功')
    log.verbose('userinfo', this.user)
    const orgsSpiner = ora('获取组织信息...').start();
    try {
      this.orgs = await this.gitServer.getOrg(this.user.login);
    } catch (error) {
      log.verbose('getOrg error', error)
      throw new Error('组织信息获取失败！')
    } finally {
      orgsSpiner.stop()
    }
    log.success(this.gitServer.type + ' 组织信息获取成功')
    log.verbose('orgsinfo', this.orgs)
  }
  // 确认远程仓库类型 user/org
  async checkGitOwner() {
    const gitOwnerPath = this.createPath(GIT_OWN_FILE);
    const gitLoginPath = this.createPath(GIT_LOGIN_FILE);
    let gitOwner = readFile(gitOwnerPath);
    let gitLogin = readFile(gitLoginPath);
    if (this.options.rechoiceOwner || !gitOwner || !gitLogin) {
      gitOwner = (await inquirer.prompt({
        type: 'list',
        name: 'owner',
        message: '请选择远程仓库类型',
        default: PERSONAL,
        choices: this.orgs.length ? GIT_OWNER_CHIOICES : GIT_OWNER_ONE,
      })).owner;
      if (gitOwner === PERSONAL) {
        gitLogin = this.user.login
      } else {
        gitLogin = (await inquirer.prompt({
          type: 'list',
          name: 'login',
          message: '请选择组织',
          choices: this.orgs.map(org => ({ name: org.login, value: org.login })),
        })).login;
      }
      writeFile(gitOwnerPath, gitOwner);
      writeFile(gitLoginPath, gitLogin);
      log.success('owner写入成功', `${gitOwner} -> ${gitOwnerPath}`);
      log.success('login写入成功', `${gitLogin} -> ${gitLoginPath}`);
    } else {
      log.success('owner读取成功', gitOwner);
      log.success('login读取成功', gitLogin);
    }
    this.owner = gitOwner;
    this.login = gitLogin;
    log.verbose('owner', gitOwner);
    log.verbose('login', gitLogin);
  }
  // 检查并创建远程仓库
  async checkGitRepo() {
    const repoSpiner = ora('获取仓库信息...').start();
    let repo;
    try {
      repo = await this.gitServer.getRepo(this.login, this.name);
      repoSpiner.stop()
      log.success(`${this.gitServer.type}:${this.name}仓库信息获取成功`)
      log.verbose('repo', repo)
    } catch (error) {
      repoSpiner.stop()
    }
    if (!repo) {
      const createSpinner = ora('远程仓库不存在，开始自动创建...').start();
      try {
        if (this.owner === PERSONAL) {
          // 创建个人仓库
          repo = await this.gitServer.createRepo(this.name);
        } else {
          // 创建组织仓库
          repo = await this.gitServer.createOrgRepo(this.name, this.login);
        }
      } catch (error) {
        log.verbose('create repo error', error)
        throw new Error('创建仓库失败!')
      } finally {
        createSpinner.stop()
      }
      log.success(`${this.gitServer.type}:${this.name}仓库创建成功`)
      log.verbose('create repo', repo)
    }
    this.repo = repo;
  }
  // 检查gitignore文件
  checkGitIgnore() {
    const gitIgnorePath = path.resolve(this.dir, '.gitignore');
    if (!fs.existsSync(gitIgnorePath)) {
      fs.writeFileSync(gitIgnorePath, `# Node.js & NPM
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build / Dist
/dist/
/build/
/out/

# Dependency directories
/.pnp/
.pnp.js

# Compiled output from various tools
/*.js
*.out
*.map
*.min.js
*.min.css

# Logs
logs
*.log
npm-debug.log*

# OS-generated files
.DS_Store
Thumbs.db

# Editor-specific
.vscode/
.idea/
*.swp
*.swo

# Compiled TypeScript
*.tsbuildinfo

# Miscellaneous
*.bak
*.tmp
*.zip
*.tar.gz
*.rar
*.7z
`)
      log.success('.gitignore文件创建成功');
    }
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
  // 本地仓库初始化
  async init() {
    // git init并关联到远程仓库
    await this.gitInitAndRemote()
    // 代码提交
    await this.initCommit()
  }
  // git init并关联到远程仓库
  async gitInitAndRemote() {
    log.info('执行git初始化');
    await this.git.init();
    log.info('添加git remote origin');
    await this.git.addRemote('origin', this.repo.ssh_url);
  }
  async initCommit() {
    // 检查是否有冲突
    await this.checkConflicts();
    // 检查是否有未提交的代码
    await this.checkUncommit();
    // 检查远程master分支
    if (await this.checkRemoteMaster()) {
      // 拉取远程master分支代码
      await this.pullRemoteBranch('master', {
        // 允许pull没有关联的master分支
        '--allow-unrelated-histories': null,
      });
    } else {
      // 创建远程master分支并推送
      await this.pushBrach('master');
    }
  }
  // 检查代码冲突
  async checkConflicts() {
    log.info('检查代码冲突');
    const status = await this.git.status();
    if (status.conflicted.length) {
      throw new Error('代码冲突，请手动解决冲突后重试！')
    }
    log.info('代码冲突检查通过');
  }
  // 检查是否有未提交的代码
  async checkUncommit() {
    log.info('检查是否有未提交的代码');
    const status = await this.git.status();
    if (
      status.not_added.length || 
      status.created.length || 
      status.deleted.length || 
      status.modified.length || 
      status.renamed.length
    ) {
      await this.git.add('.');
      const message = (await inquirer.prompt({
        type: 'input',
        name: 'message',
        message: '请输入提交信息：',
        // 必填校验
        validate: function (value) {
          if (value) {
            return true;
          }
          return '请输入提交信息！';
        }
      })).message
      await this.git.commit(message);
      log.success('代码commit成功');
    }
  }
  // 检查远程master分支 暂时只处理主分支为master的情况
  async checkRemoteMaster() {
    try {
      const refs = await this.git.listRemote(['--refs']);
      return refs.includes('refs/heads/master')
    } catch (error) {
      return false
    }
  }
  // 推送代码到指定分支
  async pushBrach(branch) {
    log.info(`推送代码到${branch}分支`);
    await this.git.push('origin', branch);
    log.success('代码推送成功');
  }
  // 拉取远程分支代码
  async pullRemoteBranch(branch, options = {}) {
    log.info(`拉取远程${branch}分支代码`);
    await this.git.pull('origin', branch, options)
      .catch(err => {
        log.error(err.message);
      });
    log.success('代码拉取成功');
  }
}

module.exports = Git;
