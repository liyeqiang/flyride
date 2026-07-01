App({
  globalData: {
    cloudEnvId: 'cloud1-d4g0h3ems1ed00de6',
    openid: null,
  },

  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true,
    });

    // openid 由云函数自动注入，无需客户端主动获取
    // 云函数内 cloud.getWXContext().OPENID 即可拿到

    // 处理 URL Scheme 回跳（保险H5完成后回小程序）
    const options = wx.getLaunchOptionsSync();
    this._handleSchemeReturn(options);
  },

  onShow(options) {
    this._handleSchemeReturn(options);
  },

  /**
   * 处理从保险H5通过 URL Scheme 回跳的情况
   * 保险H5完成页执行：location.href = 'weixin://dl/business/?ticket=xxx'
   * 小程序被唤起时 query 中携带 from=insurance&orderId=xxx
   */
  _handleSchemeReturn(options) {
    const query = options?.query || {};
    if (query.from === 'insurance' && query.orderId) {
      wx.navigateTo({
        url: `/pages/payment/index?orderId=${query.orderId}&insuranceDone=1`,
      });
    }
  },

  /**
   * 调用云函数的统一封装
   * 自动带上 cloudEnvId，统一错误处理
   */
  callCloud(name, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => {
          if (res.result && res.result.error) {
            reject(new Error(res.result.error));
          } else {
            resolve(res.result);
          }
        },
        fail: (err) => reject(new Error(err.errMsg || '云函数调用失败')),
      });
    });
  },
});
