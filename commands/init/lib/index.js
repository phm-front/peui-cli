'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

const inquirer = require('inquirer');
const semver = require('semver');
const ora = require('ora');
const kebabCase = require('kebab-case');
const { glob } = require('glob');
const ejs = require('ejs');

const Command = require('@peui-cli/command');
const log = require('@peui-cli/log');
const request = require('@peui-cli/request');
const Package = require('@peui-cli/package');
const { spawnAsync } = require('@peui-cli/utils');

// 初始化项目类型
const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

// 模版类型
const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

// 命令白名单
const WHITE_COMMAND = ['npm', 'cnpm', 'yarn'];

function init(argv) {
  return new InitCommand(argv);
}

class InitCommand extends Command {
  // 初始化
  initialize() {
    this.projectName = this._argv[0];
    this.force = this._options.force || false;
    // debug信息
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  // 执行命令
  async execute() {
    try {
      // 准备阶段 获取项目基本信息
      const projectInfo = await this.prepare();
      if (projectInfo) {
        this.projectInfo = projectInfo;
        log.verbose('projectInfo', projectInfo);
        // 下载模板
        await this.downloadTemplate();
        // 安装模板
        await this.installTemplate();
      }
    } catch (error) {
      log.error(error.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(error);
      }
    }
  }
  // 安装模版
  async installTemplate() {
    if (this.selectedTemplate) {
      const { type = TEMPLATE_TYPE_NORMAL } = this.selectedTemplate;
      switch (type) {
        case TEMPLATE_TYPE_NORMAL:
          // 标准模板安装
          await this.normalTemplateInstall();
          break;
        case TEMPLATE_TYPE_CUSTOM:
          // 自定义模板安装
          await this.customTemplateInstall();
          break;
        default:
          throw new Error(`未定义项目模版类型：${type}`);
      }
    } else {
      throw new Error('未选择模版');
    }
  }
  // ejs渲染
  async ejsRender() {
    const cwd = process.cwd();
    const { ignore = [], match = [] } = this.selectedTemplate;
    // 需要ejs渲染文件匹配
    const matchFile = [...match, 'package.json']
    const list = await glob(matchFile, {
      cwd,
      ignore,
      nodir: true
    })
    log.verbose('ejs files：', list)
    if (!list.length) {
      log.warn('未匹配到需要ejs渲染的文件')
      return
    }
    const { name, projectVersion, componentDescription } = this.projectInfo;
    const data = { name, version: projectVersion, description: componentDescription };
    await Promise.all(
      list.map(file => {
        return new Promise((resolve,reject) => {
          const filePath = path.resolve(cwd, file);
          ejs.renderFile(filePath, data, {}).then(res => {
            // 写入ejs渲染后的结果
            fse.writeFileSync(filePath, res);
            resolve()
          }).catch(err => {
            reject(err)
          })
        })
      })
    )
  }
  // 标准模板安装
  async normalTemplateInstall() {
    const { storeDir, packageName } = this.templateNpm;
    // 模版路径
    const templatePath = path.resolve(storeDir, packageName, 'template');
    const targetPath = process.cwd();
    // 确保目录存在
    const spinner = ora('正在安装模版...').start();
    fse.ensureDirSync(templatePath);
    fse.ensureDirSync(targetPath);
    fse.copySync(templatePath, targetPath);
    spinner.stop();
    log.success('模版安装成功');
    // ejs模版渲染
    await this.ejsRender();
    const {
      installCommand = 'npm i', startCommand = 'npm run dev'
    } = this.selectedTemplate;
    // 安装依赖
    const code = await this.execCommand(installCommand);
    if (code !== 0) throw new Error('依赖安装失败');
    // 运行
    this.execCommand(startCommand);
  }
  // 自定义模板安装
  async customTemplateInstall() {}
  // 执行shell命令
  async execCommand(shell) {
    const cmdArr = shell.split(' ');
    const cmd = this.checkCommand(cmdArr[0]);
    if (!cmd) throw new Error('命令不存在：' + cmdArr[0]);
    const cmdArgs = cmdArr.slice(1);
    return await spawnAsync(cmd, cmdArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  }
  // 检查命令是否存在
  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd;
    }
    return null;
  }
  // 下载模版
  async downloadTemplate() {
    const templateInfo = this.template.find(
      (item) => item.npmName === this.projectInfo.projectTemplate
    );
    this.selectedTemplate = templateInfo;
    const homePath = process.env.CLI_HOME_PATH;
    const targetPath = path.resolve(homePath, 'template');
    const templateNpm = new Package({
      targetPath,
      storeDir: path.resolve(targetPath, 'node_modules'),
      packageName: templateInfo.npmName,
      packageVersion: templateInfo.version,
    });
    if (!templateNpm.exist()) {
      await templateNpm.install();
    } else {
      await templateNpm.update();
    }
    this.templateNpm = templateNpm;
  }
  // 准备阶段
  async prepare() {
    // 判断项目模版是否存在
    // 加载动画
    const spinner = ora('获取模版信息...').start();
    let template
    try {
      template = await request.get('/project/template');
    } catch (error) {
      throw new Error('获取模版信息失败');
    } finally {
      spinner.stop();
    }
    if (!template || template.length === 0) {
      throw new Error('获取项目模版信息失败');
    }
    this.template = template;
    // 获取当前process目录路径
    const localPath = process.cwd();
    // 判断目录是否为空
    let isEmpty = this.isDirEmpty(localPath);
    if (!isEmpty && !this.force) {
      // 询问是否继续创建
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'isContinue',
          default: false,
          message:
            '当前文件夹不为空，是否继续创建项目？如果继续将删除文件夹内所有内容。',
        },
      ]);
      // 不继续直接退出
      if (!answers.isContinue) return;
      // 继续创建
      this.force = true;
    }
    // 文件夹不为空清空文件夹
    if (!isEmpty) {
      fse.emptyDirSync(localPath);
    }
    // 返回项目的基本信息
    return await this.getProjectInfo();
  }
  // 获取项目基本信息
  async getProjectInfo() {
    // 询问创建项目还是组件
    const { projectType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectType',
        message: '请选择初始化类型',
        default: TYPE_PROJECT,
        choices: [
          {
            name: '项目',
            value: TYPE_PROJECT,
          },
          {
            name: '组件',
            value: TYPE_COMPONENT,
          },
        ],
      },
    ]);
    let projectInfo = { type: projectType };
    log.verbose('projectType', projectType);
    const msgName = this.projectType === TYPE_PROJECT ? '项目' : '组件';
    const questions = [
      {
        type: 'input',
        name: 'projectName',
        message: `请确认${msgName}名称`,
        default: this.projectName,
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            // 校验规则：
            // 1. 首字母必须为英文字符
            // 2. 尾字母必须为英文或数字，不能为字符
            // 3. 字符仅允许"-_"
            // 4. 长度必须大于等于1
            if (!/^[a-zA-Z][\w-]{0,}[a-zA-Z0-9]$/.test(v)) {
              // Pass the return value in the done callback
              done('请输入合法的项目名称');
              return;
            }
            // Pass the return value in the done callback
            done(null, true);
          }, 0);
        },
      },
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${msgName}版本号`,
        default: '1.0.0',
        validate: function (v) {
          const done = this.async();
          setTimeout(() => {
            if (!semver.valid(v)) {
              done('请输入合法的版本号');
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: function (v) {
          if (!!semver.valid(v)) {
            return semver.valid(v);
          } else {
            return v;
          }
        },
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${msgName}模版`,
        choices: this.createTemplateChoice(projectType),
      },
    ]
    let reqRes = {}
    if (projectType === TYPE_PROJECT) {
      // 项目 询问项目的基本信息
      reqRes = await inquirer.prompt(questions);
    } else if (projectType === TYPE_COMPONENT) {
      // 组件
      reqRes = await inquirer.prompt(
        [
          ...questions,
          {
            type: 'input',
            name: 'componentDescription',
            message: '请输入组件描述信息',
            default: '',
            validate: function (v) {
              const done = this.async();
              setTimeout(function () {
                if (!v) {
                  // Pass the return value in the done callback
                  done('组件描述信息不能为空');
                  return;
                }
                // Pass the return value in the done callback
                done(null, true);
              }, 0);
            },
          }
        ]
      );
    }
    Object.assign(projectInfo, reqRes);
    if (projectInfo.projectName) {
      // 将项目名称转换为驼峰命名
      projectInfo.name = kebabCase(projectInfo.projectName).replace(/^-/, '');
    }
    return projectInfo;
  }
  // 创建模版选择
  createTemplateChoice(projectType) {
    return this.template.filter(item => item.tag.includes(projectType))
      .map(item => ({ value: item.npmName, name: item.name, }));
  }
  // cwd文件夹是否为空 缓存类文件夹不算在内
  isDirEmpty(path) {
    let fileList = fs.readdirSync(path);
    // 过滤掉缓存文件夹
    fileList = fileList.filter(
      (file) =>
        file !== '.DS_Store' && !file.startsWith('.') && file !== 'node_modules'
    );
    return !fileList.length;
  }
}

module.exports = init;
module.exports.InitCommand = InitCommand;
