const app = getApp();

const POLL_INTERVAL = 3000;
const POLL_MAX = 40; // 轮询上限提高到 40 次（120秒），覆盖用户在外部完成保险的时间

Page({
  data: {
    orderId: '',
    insuranceUrl: '',
    showWebview: false,   // 保留字段，WXML 中 web-view 逻辑不变
    waiting: false,       // 用户已跳出去购险，显示等待状态
  },

  _pollTimer: null,
  _pollCount: 0,

  onLoad(options) {
    this.setData({
      orderId: options.orderId,
      insuranceUrl: decodeURIComponent(options.insuranceUrl || ''),
    });
    app.callCloud('markInsurancePending', { orderId: options.orderId }).catch(() => {});
  },

  onShow() {
    // 用户从外部浏览器返回小程序时触发
    // 如果已处于等待状态，立即做一次订单状态查询
    if (this.data.waiting) {
      this._doPoll();
    }
  },

  onUnload() {
    this._stopPoll();
  },

  /**
   * 打开保险H5
   *
   * 体验版/正式版：web-view 受业务域名白名单限制，exx.95505.cn 未配置时会报"无法打开该页面"
   * 解决方案：改用 wx.openUrl 在微信内置浏览器打开，不受 web-view 白名单限制
   * 用户完成保险后手动返回小程序，onShow 触发轮询检测状态
   */
  openInsurance() {
    const url = this.data.insuranceUrl;
    if (!url) {
      wx.showToast({ title: '保险链接异常，请重试', icon: 'none' });
      return;
    }

    // wx.openUrl：在微信内置浏览器打开任意 HTTPS 链接，无域名白名单限制
    wx.openUrl({
      url,
      fail: () => {
        // wx.openUrl 在低版本基础库不支持时的降级：复制链接提示用户
        wx.setClipboardData({
          data: url,
          success: () => {
            wx.showModal({
              title: '请在浏览器中完成保险购买',
              content: '链接已复制，请粘贴到浏览器打开。完成购险后返回本小程序继续支付体验费。',
              showCancel: false,
            });
          },
        });
      },
    });

    // 标记等待状态，开始轮询
    this.setData({ waiting: true });
    this._startPoll();
  },

  // web-view 相关（仅当业务域名白名单配置后才会生效）
  onWebviewMsg(e) {
    const msgs = e.detail.data || [];
    const last = msgs[msgs.length - 1];
    if (last?.event === 'insuranceDone') {
      this._stopPoll();
      this._handleInsuranceDone();
    }
  },

  onWebviewLoad() {
    console.log('保险H5加载成功');
  },

  onWebviewError() {
    // web-view 加载失败时自动降级到 wx.openUrl 方式
    wx.showToast({ title: '内嵌加载失败，切换外部打开', icon: 'none' });
    this.setData({ showWebview: false });
    setTimeout(() => this.openInsurance(), 800);
  },

  // ── 跳过按钮 ────────────────────────────────────────────────────
  skipInsurance() {
    wx.showModal({
      title: '确认跳过',
      content: '跳过后将直接进行体验费支付。仅适用于已另行购买保险的情况。',
      confirmText: '确认跳过',
      cancelText: '返回购买',
      success: ({ confirm }) => {
        if (confirm) this._handleInsuranceDone(true);
      },
    });
  },

  // ── 轮询订单状态（万能兜底） ─────────────────────────────────────
  _startPoll() {
    this._pollCount = 0;
    this._pollTimer = setInterval(() => this._doPoll(), POLL_INTERVAL);
  },

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  async _doPoll() {
    if (++this._pollCount > POLL_MAX) { this._stopPoll(); return; }
    try {
      const order = await app.callCloud('getOrder', { orderId: this.data.orderId });
      if (order.status === 'ins_done') {
        this._stopPoll();
        // 保险公司 Webhook 已触发更新，直接跳转
        this._goToPayment();
      }
    } catch (_) {}
  },

  // ── 处理保险完成 ──────────────────────────────────────────────────
  async _handleInsuranceDone(force = false) {
    if (!force) {
      try {
        await app.callCloud('markInsuranceDone', { orderId: this.data.orderId });
      } catch (_) {}
    }
    this._goToPayment();
  },

  _goToPayment() {
    wx.redirectTo({
      url: `/pages/payment/index?orderId=${this.data.orderId}`,
    });
  },
});
