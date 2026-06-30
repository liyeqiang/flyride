const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext();
  const { orderId } = event;

  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();
    if (order.openid !== wxCtx.OPENID) {
      return { error: '无权操作此订单' };
    }
    if (order.status !== 'created') {
      return { success: true, alreadyPending: true };
    }

    await db.collection('fly_orders').doc(orderId).update({
      data: {
        status: 'ins_pending',
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
};
