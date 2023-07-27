function error(funName) {
  throw new Error(`必须实现${funName}方法`);
}
class GitServer {
  constructor(type, helpUrl, token) {
    this.type = type;
    this.helpUrl = helpUrl;
    this.token = token;
  }
  setToken() {
    error('setToken');
  }
  createRepo() {
    error('createRepo');
  }
  createOrgRepo() {
    error('createOrgRepo');
  }
  getRemote() {
    error('getRemote');
  }
  getUser() {
    error('getUser');
  }
  getOrg() {
    error('getOrg');
  }
}

module.exports = GitServer;