const GitServer = require('./gitServer');
const GiteeRequest = require('./giteeRequest');

const GITEE_URL = 'https://gitee.com/api/v5';

class Gitee extends GitServer {
  constructor() {
    super(
      'gitee',
      'https://help.gitee.com/base/account/SSH%E5%85%AC%E9%92%A5%E8%AE%BE%E7%BD%AE'
    );
    this.token = null;
    this.giteeRequest = null;
  }
  setToken(token) {
    this.token = token;
    this.giteeRequest = new GiteeRequest(token, GITEE_URL);
  }
  getUser() {
    return this.giteeRequest.get('/user')
  }
  getOrg(username) {
    return this.giteeRequest.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100,
    })
  }
}

module.exports = Gitee;
