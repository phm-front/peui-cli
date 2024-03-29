const axios = require('axios');
const log = require('@peui-cli/log');
class GiteeRequest {
  constructor(token) {
    this.token = token;
    this.request = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 10000,
    });
    this.request.interceptors.request.use(
      config => {
        config.headers.Authorization = `Bearer ${this.token}`;
        config.headers['X-GitHub-Api-Version'] = '2022-11-28';
        return config;
      },
      error => Promise.reject(error)
    )
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
      params,
      headers
    })
  }
  post(url, data = {}, headers = {}) {
    return this.request({
      method: 'POST',
      url,
      data,
      headers
    })
  }
}

module.exports = GiteeRequest;
