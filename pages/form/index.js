const app = getApp();
const { isValidPhone, isValidIdNo, calcAgeFromIdNo } = require('../../utils/validate.js');

Page({
  data: {
    riderName: '',
    riderPhone: '',
    riderIdNo: '',
    riderWeight: '',
    submitting: false,
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value.trim() });
  },

  async submit() {
    const { riderName, riderPhone, riderIdNo, riderWeight, submitting } = this.data;
    if (submitting) return;

    if (!riderName) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!isValidPhone(riderPhone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!isValidIdNo(riderIdNo)) {
      wx.showToast({ title: '身份证号格式不正确', icon: 'none' });
      return;
    }
    const age = calcAgeFromIdNo(riderIdNo);
    if (age !== null && age < 18) {
      wx.showToast({ title: '需年满18周岁方可预约', icon: 'none' });
      return;
    }
    if (riderWeight) {
      const w = parseFloat(riderWeight);
      if (Number.isNaN(w) || w <= 0 || w > 120) {
        wx.showToast({ title: '体重需在120kg以内', icon: 'none' });
        return;
      }
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '创建订单...' });

    try {
      const res = await app.callCloud('createOrder', {
        riderName,
        riderPhone,
        riderIdNo,
        riderWeight,
      });
      if (res.error) throw new Error(res.error);

      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/insurance/index?orderId=${res.orderId}&insuranceUrl=${encodeURIComponent(res.insuranceUrl)}`,
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
