const GitServer = require('./gitServer');
const GiteeRequest = require('./giteeRequest');

class Gitee extends GitServer {
  constructor() {
    super(
      'gitee',
      'https://gitee.com/profile/personal_access_tokens'
    );
    this.token = null;
    this.giteeRequest = null;
  }
  setToken(token) {
    this.token = token;
    this.giteeRequest = new GiteeRequest(token);
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
  getRepo(username, repo) {
    return this.giteeRequest.get(`/repos/${username}/${repo}`)
  }
  createRepo(repoName) {
    return this.giteeRequest.post('/user/repos', {
      name: repoName,
    })
  }
  createOrgRepo(repoName, orgName) {
    return this.giteeRequest.post(`/orgs/${orgName}/repos`, {
      name: repoName,
    })
  }
}

module.exports = Gitee;
