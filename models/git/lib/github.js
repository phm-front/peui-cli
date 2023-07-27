const GitServer = require('./gitServer');

class Github extends GitServer {
  constructor() {
    super(
      'github',
      'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent',
    );
  }
  setToken(token) {
    this.token = token;
  }
  getUser() {
    
  }
}

module.exports = Github;
