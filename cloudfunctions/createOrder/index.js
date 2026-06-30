const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const INSURANCE_BASE = 'https://exx.95505.cn/projectE/pages/productDetail/index';
const INSURANCE_PARAMS = {
  thirdChannelCode: 'shenzhengexian',
  productId: '64807',
  thirdOrgCode: '012030A10230',
  channelCode: '01',
  issueWay: '05',
  internetFlag: '0',
  intermediary: 'true',
  userId: '527908',
};

const INSURANCE_EXPIRE_MS = 30 * 60 * 1000;

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext();
  const openid = wxCtx.OPENID;
  const { riderName, riderPhone, riderIdNo, riderWeight } = event;

  if (!riderName || !riderPhone || !riderIdNo) {
    return { error: '姓名、手机号、身份证号为必填项' };
  }
  if (!/^1[3-9]\d{9}$/.test(riderPhone)) {
    return { error: '手机号格式不正确' };
  }
  if (!/^\d{17}[\dX]$/i.test(riderIdNo)) {
    return { error: '身份证号格式不正确' };
  }

  const orderId = 'FR' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();
  const params = new URLSearchParams({
    ...INSURANCE_PARAMS,
    ext_order_id: orderId,
    name: riderName,
    phone: riderPhone,
    id_no: riderIdNo,
  });
  const insuranceUrl = `${INSURANCE_BASE}?${params.toString()}`;

  const now = new Date();
  const expireAt = new Date(now.getTime() + INSURANCE_EXPIRE_MS);

  await db.collection('fly_orders').add({
    data: {
      _id: orderId,
      openid,
      riderName,
      riderPhone,
      riderIdNo,
      riderWeight: riderWeight || '',
      status: 'created',
      insuranceUrl,
      insuranceDoneAt: null,
      experiencePaidAt: null,
      wxTransactionId: null,
      expireAt,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { orderId, insuranceUrl, expireAt };
};
