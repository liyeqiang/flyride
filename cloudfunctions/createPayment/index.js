const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const EXPERIENCE_FEE = 19800;
const CLOUD_ENV_ID = 'cloud1-d4g0h3ems1ed00de6';

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext();
  const { orderId } = event;

  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    if (order.openid !== wxCtx.OPENID) {
      return { error: '无权操作此订单' };
    }
    if (order.status !== 'ins_done') {
      return { error: '请先完成保险购买' };
    }
    if (new Date() > new Date(order.expireAt)) {
      await db.collection('fly_orders').doc(orderId).update({
        data: { status: 'expired', updatedAt: new Date() },
      });
      return { error: '订单已超时，请重新预约' };
    }

    const res = await cloud.cloudPay.unifiedOrder({
      body: '飞行摩托体验费',
      outTradeNo: orderId,
      spbillCreateIp: '127.0.0.1',
      subMchId: '你的商户号',
      totalFee: EXPERIENCE_FEE,
      envId: CLOUD_ENV_ID,
      functionName: 'payNotify',
    });

    return { payment: res.payment };
  } catch (e) {
    console.error('createPayment error', e);
    return { error: e.message };
  }
};
