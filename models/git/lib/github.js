const GitServer = require('./gitServer');
const GithubRequest = require('./githubRequest');

class Github extends GitServer {
  constructor() {
    super('github', 'https://github.com/settings/tokens');
    this.token = null;
    this.githubRequest = null;
  }
  setToken(token) {
    this.token = token;
    this.githubRequest = new GithubRequest(token);
  }
  getUser() {
    return this.githubRequest.get('/user');
  }
  getOrg() {
    return this.githubRequest.get('/user/orgs');
  }
  getRepo(login, repo) {
    return this.githubRequest.get(`/repos/${login}/${repo}`);
  }
  createRepo(repoName) {
    return this.githubRequest.post('/user/repos', {
      name: repoName,
    })
  }
  createOrgRepo(repoName, orgName) {
    return this.githubRequest.post(`/orgs/${orgName}/repos`, {
      name: repoName,
    })
  }
}

module.exports = Github;
