const app = getApp();

const STATUS_TEXT = {
  created: '待购买保险',
  ins_pending: '待完成保险',
  ins_done: '待支付体验费',
  exp_paid: '待核销',
  completed: '已完成',
  expired: '已超时',
  payment_error: '支付异常',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    orders: [],
    loading: true,
  },

  onShow() {
    this._loadOrders();
  },

  async _loadOrders() {
    this.setData({ loading: true });
    try {
      const res = await app.callCloud('listMyOrders');
      const orders = (res.orders || []).map((o) => ({
        ...o,
        statusText: STATUS_TEXT[o.status] || o.status,
        createdAtText: formatDate(o.createdAt),
      }));
      this.setData({ orders });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goOrder(e) {
    const { orderId } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/payment/index?orderId=${orderId}` });
  },
});
