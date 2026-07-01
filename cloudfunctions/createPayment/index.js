const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const EXPERIENCE_FEE = 19800;
const CLOUD_ENV_ID = 'cloud1-d4g0h3ems1ed00de6';

// 微信支付商户号：云开发控制台 → 设置 → 全局设置 → 微信支付配置 中绑定的商户号
// ⚠️ 上线前必须修改为真实商户号，否则微信支付无法发起（当前占位值会导致 wx.requestPayment 报 parameter error）
const SUB_MCH_ID = '1681234099';

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext();
  const { orderId } = event;

  if (!orderId) return { error: '缺少 orderId' };
  if (!SUB_MCH_ID || SUB_MCH_ID === '你的商户号') {
    console.error('createPayment: SUB_MCH_ID 未配置为真实商户号');
    return { error: '支付功能未配置商户号，请联系管理员' };
  }

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    if (order.openid !== wxCtx.OPENID) {
      return { error: '无权操作此订单' };
    }
    // 体验费支付与保险购买互相独立，无需等待保险购买完成即可支付
    if (['exp_paid', 'completed'].includes(order.status)) {
      return { error: '体验费已支付，无需重复支付' };
    }
    if (order.status === 'expired') {
      return { error: '订单已超时，请重新预约' };
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
      subMchId: SUB_MCH_ID,
      totalFee: EXPERIENCE_FEE,
      envId: CLOUD_ENV_ID,
      functionName: 'payNotify',
    });

    // unifiedOrder 业务失败时不会抛异常，而是返回不含 payment 的响应
    // 必须校验后再回传，否则前端会用 undefined 调 wx.requestPayment 报 parameter error
    if (!res.payment) {
      console.error('createPayment: unifiedOrder 未返回支付参数', res);
      return { error: res.errMsg || res.returnMsg || '发起支付失败，请重试' };
    }

    return { payment: res.payment };
  } catch (e) {
    console.error('createPayment error', e);
    return { error: e.message };
  }
};
