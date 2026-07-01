const app = getApp();

Page({
  data: {
    staffCode: '',
    orderId: '',
    order: null,
    loading: false,
    verifying: false,
  },

  onStaffCodeInput(e) {
    this.setData({ staffCode: e.detail.value.trim() });
  },

  onOrderIdInput(e) {
    this.setData({ orderId: e.detail.value.trim() });
  },

  async lookup() {
    const { staffCode, orderId } = this.data;
    if (!staffCode) {
      wx.showToast({ title: '请输入工作人员口令', icon: 'none' });
      return;
    }
    if (!orderId) {
      wx.showToast({ title: '请输入订单号', icon: 'none' });
      return;
    }

    this.setData({ loading: true, order: null });
    wx.showLoading({ title: '查询中...' });
    try {
      const res = await app.callCloud('verifyOrder', { orderId, staffCode, action: 'lookup' });
      if (res.error) {
        wx.showToast({ title: res.error, icon: 'none' });
        return;
      }
      this.setData({ order: res });
    } catch (err) {
      wx.showToast({ title: err.message || '查询失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async confirmVerify() {
    const { staffCode, orderId, verifying } = this.data;
    if (verifying) return;

    this.setData({ verifying: true });
    wx.showLoading({ title: '核销中...' });
    try {
      const res = await app.callCloud('verifyOrder', { orderId, staffCode, action: 'confirm' });
      if (res.error) {
        wx.showToast({ title: res.error, icon: 'none' });
        return;
      }
      wx.showToast({ title: '核销成功', icon: 'success' });
      this.setData({ order: { ...this.data.order, status: 'completed' } });
    } catch (err) {
      wx.showToast({ title: err.message || '核销失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ verifying: false });
    }
  },
});
