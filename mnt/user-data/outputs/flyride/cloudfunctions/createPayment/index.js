// cloudfunctions/createPayment/index.js
/**
 * 发起体验费微信支付
 *
 * 使用云开发"云调用"方式，无需 APIv3 证书、无需手动签名。
 * 前置条件：在云开发控制台 → 设置 → 全局设置 → 微信支付配置
 *          绑定商户号（即李叶强注册后的商户号 subMchId）
 *
 * 入参：{ orderId }
 * 出参：{ payment }  ← 直接传给 wx.requestPayment
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const EXPERIENCE_FEE = 19800;   // 单位：分（¥198.00）
const CLOUD_ENV_ID = 'cloud1-d4g0h3ems1ed00de6';

exports.main = async (event, context) => {
  const wxCtx = cloud.getWXContext();
  const { orderId } = event;

  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    // ── 校验订单状态 ─────────────────────────────────────────────
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

    // ── 云调用统一下单（无需证书/签名，自动获取 payment 参数） ────
    const res = await cloud.cloudPay.unifiedOrder({
      body: '飞行摩托体验费',
      outTradeNo: orderId,
      spbillCreateIp: '127.0.0.1',
      subMchId: '你的商户号',    // ← 替换为实际商户号
      totalFee: EXPERIENCE_FEE,
      envId: CLOUD_ENV_ID,
      functionName: 'payNotify',  // 支付成功后触发的回调云函数名
    });

    // 返回 payment 对象给小程序端直接调用 wx.requestPayment
    return { payment: res.payment };
  } catch (e) {
    console.error('createPayment error', e);
    return { error: e.message };
  }
};
