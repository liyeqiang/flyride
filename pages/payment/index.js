const app = getApp();

Page({
  data: {
    orderId: '',
    order: {},
    insuranceDone: false,
    isPaid: false,
    expired: false,
    paying: false,
    expireText: '',
  },

  _pollTimer: null,
  _expireTimer: null,

  onLoad(options) {
    const { orderId, insuranceDone } = options;
    this.setData({ orderId });

    if (insuranceDone === '1') {
      app.callCloud('markInsuranceDone', { orderId }).catch(() => {});
    }

    this._loadOrder();
    this._startPoll();
  },

  onUnload() {
    this._stopPoll();
    if (this._expireTimer) clearInterval(this._expireTimer);
  },

  async _loadOrder() {
    try {
      const order = await app.callCloud('getOrder', { orderId: this.data.orderId });
      if (order.error) {
        wx.showToast({ title: order.error, icon: 'none' });
        return;
      }
      this._applyOrder(order);
    } catch (_) {}
  },

  _applyOrder(order) {
    const insuranceDone = ['ins_done', 'exp_paid', 'completed'].includes(order.status);
    const isPaid = ['exp_paid', 'completed'].includes(order.status);
    const expired = order.status === 'expired';

    this.setData({ order, insuranceDone, isPaid, expired });

    if (insuranceDone && !isPaid && order.expireAt) {
      this._startExpireCountdown(new Date(order.expireAt));
    }
    if (isPaid || expired) this._stopPoll();
  },

  _startPoll() {
    this._pollTimer = setInterval(() => this._loadOrder(), 3000);
  },

  _stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  _startExpireCountdown(expireAt) {
    if (this._expireTimer) clearInterval(this._expireTimer);
    const tick = () => {
      const ms = expireAt - Date.now();
      if (ms <= 0) {
        this.setData({ expireText: '已超时', expired: true });
        clearInterval(this._expireTimer);
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      this.setData({ expireText: `${m}分${String(s).padStart(2, '0')}秒` });
    };
    tick();
    this._expireTimer = setInterval(tick, 1000);
  },

  goBackInsurance() {
    wx.navigateBack();
  },

  restartBooking() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  async payExperience() {
    if (this.data.paying) return;
    this.setData({ paying: true });
    wx.showLoading({ title: '准备支付...' });

    try {
      const res = await app.callCloud('createPayment', { orderId: this.data.orderId });
      if (res.error) throw new Error(res.error);

      wx.hideLoading();

      await new Promise((resolve, reject) => {
        wx.requestPayment({
          ...res.payment,
          success: resolve,
          fail: (err) => reject(new Error(
            err.errMsg.includes('cancel') ? 'CANCEL' : err.errMsg
          )),
        });
      });

      wx.showToast({ title: '支付成功！', icon: 'success' });
      this._stopPoll();
      setTimeout(() => this._loadOrder(), 1500);
    } catch (err) {
      wx.hideLoading();
      if (err.message !== 'CANCEL') {
        wx.showToast({ title: err.message || '支付失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ paying: false });
    }
  },
});
