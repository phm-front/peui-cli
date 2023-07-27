const axios = require('axios');

class GiteeRequest {
  constructor(token, baseURL) {
    this.token = token;
    this.request = axios.create({
      baseURL,
      timeout: 5000,
    });
    this.request.interceptors.response.use(
      response => response.data,
      error => {
        if (error.response && error.response.data) {
          return error.response.data;
        } else {
          return Promise.reject(error);
        }
      }
    );
  }
  get(url, params = {}, headers = {}) {
    return this.request({
      type: 'GET',
      url,
      params: {
        ...params,
        access_token: this.token,
      },
      headers
    })
  }
}

module.exports = GiteeRequest;
