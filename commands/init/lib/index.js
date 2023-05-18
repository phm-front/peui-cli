'use strict';

const fs = require('fs');
const fse = require('fs-extra');

const inquirer = require('inquirer');
const semver = require('semver');
const Command = require('@peui-cli/command');
const log = require('@peui-cli/log');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

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
        log.verbose('projectInfo', projectInfo)
        // 下载模板
        // 安装模板
      }
    } catch (error) {
      log.error(error.message);
    }
  }
  // 准备阶段
  async prepare() {
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
    if (projectType === TYPE_PROJECT) { // 项目
      // 询问项目的基本信息
      const project = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: '请确认项目名称',
          default: this.projectName,
          validate: function(v) {
            const done = this.async();
            setTimeout(function() {
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
          }
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
          default: '1.0.0',
          validate: function(v) {
            const done = this.async();
            setTimeout(() => {
              if (!semver.valid(v)) {
                done('请输入合法的版本号');
                return;
              }
              done(null, true);
            }, 0)
          },
          filter: function(v) {
            if (!!semver.valid(v)) {
              return semver.valid(v)
            } else {
              return v
            }
          }
        }
      ])
      projectInfo = Object.assign(projectInfo, project)
    } else if (projectType === TYPE_COMPONENT) { // 组件

    }
    return projectInfo;
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
