const app = getApp();

const POLL_INTERVAL = 3000;
const POLL_MAX = 40; // 轮询上限提高到 40 次（120秒），覆盖用户在保险H5内完成支付的时间

Page({
  data: {
    orderId: '',
    insuranceUrl: '',
    showWebview: false,   // true：保险H5以 web-view 方式内嵌在小程序内展示
    waiting: false,       // 仅在内嵌失败降级到外部浏览器时使用
  },

  _pollTimer: null,
  _pollCount: 0,

  onLoad(options) {
    this.setData({
      orderId: options.orderId,
      insuranceUrl: decodeURIComponent(options.insuranceUrl || ''),
    });
    app.callCloud('markInsurancePending', { orderId: options.orderId }).catch(() => {});
    // 填完信息点下一步后直接打开保险H5，不停留在引导页
    this.openInsurance();
  },

  onShow() {
    // 外部浏览器降级场景下，用户返回小程序时立即做一次订单状态查询
    if (this.data.waiting) {
      this._doPoll();
    }
  },

  onUnload() {
    this._stopPoll();
  },

  /**
   * 打开保险H5：直接在小程序内以 web-view 内嵌展示
   * 前提：需在小程序管理后台「开发设置 → 业务域名」中配置 exx.95505.cn，否则内嵌会加载失败
   *
   * 保险完成信号（三选一，命中任意一种即可推进流程）：
   * 1. H5 调用 wx.miniProgram.postMessage({event:'insuranceDone'}) → onWebviewMsg
   * 2. 保险公司 Webhook 回调 markInsuranceDone → 本页轮询 getOrder 感知状态变化
   * 3. 用户在内嵌页底部工具栏手动点击"已完成购买"
   */
  openInsurance() {
    const url = this.data.insuranceUrl;
    if (!url) {
      wx.showModal({
        title: '保险链接异常',
        content: '请返回重新预约',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    this.setData({ showWebview: true });
    this._startPoll();
  },

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
    // 内嵌加载失败（例如业务域名未配置）时，降级到微信内置浏览器打开
    wx.showToast({ title: '内嵌加载失败，切换外部打开', icon: 'none' });
    this.setData({ showWebview: false });
    this._openExternal();
  },

  // 悬浮小按钮：避免使用横跨全宽的固定工具栏遮挡/拦截 H5 自身弹窗与按钮的点击
  showWebviewActions() {
    wx.showActionSheet({
      itemList: ['已完成购买，继续下一步', '保险已在其他设备购买，跳过此步'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) this.confirmInsuranceDone();
        if (tapIndex === 1) this.skipInsurance();
      },
    });
  },

  // 手动确认已完成保险购买
  confirmInsuranceDone() {
    wx.showModal({
      title: '确认已完成保险购买',
      content: '请确保已在上方页面完成支付，再点击继续。',
      confirmText: '继续下一步',
      cancelText: '再看看',
      success: ({ confirm }) => {
        if (confirm) {
          this._stopPoll();
          this._handleInsuranceDone();
        }
      },
    });
  },

  // 内嵌失败后的降级方案：微信内置浏览器打开（不受 web-view 业务域名限制）
  _openExternal() {
    const url = this.data.insuranceUrl;
    wx.openUrl({
      url,
      fail: () => {
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
    this.setData({ waiting: true });
    this._startPoll();
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
    if (this._pollTimer) return;
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
