const axios = require('axios');

class GiteeRequest {
  constructor(token) {
    this.token = token;
    this.request = axios.create({
      baseURL: 'https://gitee.com/api/v5',
      timeout: 10000,
    });
    this.request.interceptors.response.use(
      response => response.data,
      error => {
        if (error.response) {
          if (error.response.status === 401) {
            log.warn('token失效，请重新设置token！');
          }
          return Promise.reject(error.response);
        } else {
          return Promise.reject(error);
        }
      }
    );
  }
  get(url, params = {}, headers = {}) {
    return this.request({
      method: 'GET',
      url,
      params: {
        ...params,
        access_token: this.token,
      },
      headers
    })
  }
  post(url, data, headers = {}) {
    return this.request({
      method: 'POST',
      url,
      params: {
        access_token: this.token,
      },
      data,
      headers
    })
  }
}

module.exports = GiteeRequest;
