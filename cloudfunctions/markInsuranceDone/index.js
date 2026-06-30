const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  let orderId;

  if (event.httpMethod) {
    try {
      const body = typeof event.body === 'string'
        ? JSON.parse(event.body)
        : event.body;

      if (body.status !== 'SUCCESS' && body.status !== '1') {
        return { errcode: 0, errmsg: 'ignored' };
      }
      orderId = body.ext_order_id || body.outOrderId || body.order_id;
    } catch (e) {
      return { errcode: -1, errmsg: 'body parse failed' };
    }
  } else {
    orderId = event.orderId;
  }

  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    if (['ins_done', 'exp_paid', 'completed'].includes(order.status)) {
      return { success: true, alreadyDone: true };
    }
    if (!['created', 'ins_pending'].includes(order.status)) {
      return { error: `订单状态不允许完成保险: ${order.status}` };
    }

    const expireAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.collection('fly_orders').doc(orderId).update({
      data: {
        status: 'ins_done',
        insuranceDoneAt: new Date(),
        expireAt,
        updatedAt: new Date(),
      },
    });

    return { errcode: 0, success: true };
  } catch (e) {
    return { error: e.message };
  }
};
