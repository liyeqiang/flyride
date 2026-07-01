const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxCtx = cloud.getWXContext();
  const openid = wxCtx.OPENID;

  const { data } = await db.collection('fly_orders')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .field({ riderIdNo: false })
    .get();

  return { orders: data };
};
