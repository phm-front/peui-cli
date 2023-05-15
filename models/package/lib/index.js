'use strict';

const path = require('path');
const { execSync } = require('child_process')
const pkgDir = require('pkg-dir').sync;
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;
const semver = require('semver');

const { isObject } = require('@peui-cli/utils');
const formatPath = require('@peui-cli/format-path');

class Package {
  constructor(options) {
    if (!options) throw new Error('Package类的options参数不能为空');
    if (!isObject(options)) throw new Error('Package类的options参数必须为对象');
    // package的路径
    this.targetPath = options.targetPath;
    // 缓存package的路径
    this.storeDir = options.storeDir;
    // package的name
    this.packageName = options.packageName;
    // package的version
    this.packageVersion = options.packageVersion;
  }
  // 判断当前的package是否存在
  exist() {
    if (this.storeDir) {
      // 当前包来自缓存
      return pathExists(path.resolve(this.storeDir, this.packageName))
    } else {
      // 用户通过-tp指定路径
      return pathExists(this.targetPath);
    }
  }
  // 安装package
  install() {
    // 不用判断targetPath是否存在，因为npminstall会自动创建
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: 'https://registry.npmjs.org',
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion,
        },
      ],
    });
  }
  // 更新package
  async update() {
    const latestVersion = execSync(`npm view ${this.packageName} version`).toString();
    // 获取缓存中的package版本
    const cacheDir = pkgDir(path.resolve(this.storeDir, this.packageName))
    const cachePkg = require(path.resolve(cacheDir, 'package.json'))
    const cacheVersion = cachePkg.version;
    // 最新版本大于缓存中的版本，更新
    if (semver.gt(latestVersion, cacheVersion)) {
      await this.install();
    }
  }
  // 获取入口文件的路径
  getRootFilePath() {
    let targetPath = this.targetPath;
    if (this.storeDir) {
      targetPath = path.resolve(this.storeDir, this.packageName);
    }
    // 1. 获取package.json所在目录 - pkg-dir
    const rootPath = pkgDir(targetPath);
    if (!rootPath) return null;
    // 2. 读取package.json - require()
    const pkg = require(path.resolve(rootPath, 'package.json'));
    // 3. 寻找main/lib - path
    if (pkg && pkg.main) {
      // 4. 路径的兼容(macOS/windows)
      return formatPath(path.resolve(rootPath, pkg.main));
    }
    return null;
  }
}

module.exports = Package;
