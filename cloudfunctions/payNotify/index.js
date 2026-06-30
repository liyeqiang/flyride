const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  console.log('payNotify event:', JSON.stringify(event));

  if (event.return_code !== 'SUCCESS') {
    return { errcode: 0, errmsg: 'ok' };
  }

  const orderId = event.out_trade_no;
  const wxTransactionId = event.transaction_id;
  const paidFee = event.total_fee;

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();

    if (['exp_paid', 'completed'].includes(order.status)) {
      return { errcode: 0, errmsg: 'already processed' };
    }

    if (paidFee < 19800) {
      console.error(`金额异常: 应收19800分，实收${paidFee}分，订单: ${orderId}`);
      await db.collection('fly_orders').doc(orderId).update({
        data: {
          status: 'payment_error',
          wxTransactionId,
          paidFee,
          updatedAt: new Date(),
        },
      });
      return { errcode: 0, errmsg: 'ok' };
    }

    await db.collection('fly_orders').doc(orderId).update({
      data: {
        status: 'exp_paid',
        wxTransactionId,
        paidFee,
        experiencePaidAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`订单 ${orderId} 体验费支付成功，流水号: ${wxTransactionId}`);
  } catch (e) {
    console.error('payNotify 处理失败:', e);
  }

  return { errcode: 0, errmsg: 'ok' };
};
