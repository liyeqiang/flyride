const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Webhook 密钥：保险公司回调 URL 需要拼接 ?token=此密钥，例如：
// https://xxx.ap-shanghai.app.tcloudbase.com/markInsuranceDone?token=xxxx
// ⚠️ 上线前必须修改：云开发控制台 → 云函数 → markInsuranceDone → 版本与配置 → 环境变量 → 新增 INSURANCE_WEBHOOK_TOKEN
const WEBHOOK_TOKEN = process.env.INSURANCE_WEBHOOK_TOKEN || '请修改此默认密钥';

exports.main = async (event) => {
  let orderId;
  const isWebhook = !!event.httpMethod;

  if (isWebhook) {
    // 校验 Webhook 密钥，防止任何人伪造回调把订单标记为"保险已完成"
    const token = (event.queryStringParameters || {}).token;
    if (!token || token !== WEBHOOK_TOKEN) {
      console.error('markInsuranceDone: webhook token 校验失败');
      return { errcode: -1, errmsg: 'unauthorized' };
    }
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

    // 小程序前端直接调用时，校验只有订单所有者才能操作（"跳过保险"场景）
    if (!isWebhook) {
      const wxCtx = cloud.getWXContext();
      if (order.openid !== wxCtx.OPENID) {
        return { error: '无权操作此订单' };
      }
    }

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
