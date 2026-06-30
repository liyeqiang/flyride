Page({
  data: {
    insuranceFee: '15.00',
    experienceFee: '198.00',
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/form/index' });
  },
});
