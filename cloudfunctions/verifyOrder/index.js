const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { orderId, verifyCode } = event;

  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    if (order.status !== 'exp_paid') {
      return { error: `订单状态不可核销: ${order.status}` };
    }

    await db.collection('fly_orders').doc(orderId).update({
      data: {
        status: 'completed',
        verifiedAt: new Date(),
        verifyCode: verifyCode || '',
        updatedAt: new Date(),
      },
    });

    return { success: true, riderName: order.riderName };
  } catch (e) {
    return { error: e.message };
  }
};
