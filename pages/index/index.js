Page({
  data: {
    insuranceFee: '20.00',
    experienceFee: '198.00',
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/form/index' });
  },

  goMyOrders() {
    wx.navigateTo({ url: '/pages/orders/index' });
  },

  goStaffVerify() {
    wx.navigateTo({ url: '/pages/verify/index' });
  },
});
