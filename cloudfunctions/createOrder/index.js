const cloud = require('wx-server-sdk');
const crypto = require('crypto');
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
const MAX_WEIGHT_KG = 120;
const MIN_AGE = 18;

// 身份证加密密钥，必须与 verifyOrder 云函数中的 ID_ENC_SECRET 完全一致
// ⚠️ 上线前必须修改，并在两个云函数的环境变量中设置相同的 ID_ENC_SECRET
const ID_ENC_SECRET = process.env.ID_ENC_SECRET || 'flyride-default-secret-change-me';
const ID_ENC_KEY = crypto.createHash('sha256').update(ID_ENC_SECRET).digest();

function encryptIdNo(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ID_ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
}

// 18位身份证第7-14位为出生日期(YYYYMMDD)，据此计算周岁年龄
function calcAge(idNo) {
  const y = parseInt(idNo.slice(6, 10), 10);
  const m = parseInt(idNo.slice(10, 12), 10);
  const d = parseInt(idNo.slice(12, 14), 10);
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

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

  const age = calcAge(riderIdNo);
  if (age !== null && age < MIN_AGE) {
    return { error: `需年满${MIN_AGE}周岁方可预约体验` };
  }

  if (riderWeight) {
    const w = parseFloat(riderWeight);
    if (Number.isNaN(w) || w <= 0 || w > MAX_WEIGHT_KG) {
      return { error: `体重需在 ${MAX_WEIGHT_KG}kg 以内` };
    }
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
      riderIdNo: encryptIdNo(riderIdNo), // 加密存储，明文只用于拼接保险H5链接，不落库
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
