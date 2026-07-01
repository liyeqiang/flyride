const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 工作人员核销口令：只有知道此口令的现场工作人员才能查询/核销订单
// ⚠️ 上线前必须修改：云开发控制台 → 云函数 → verifyOrder → 版本与配置 → 环境变量 → 新增 STAFF_PASSCODE
const STAFF_PASSCODE = process.env.STAFF_PASSCODE || '请修改此默认口令';

// 身份证解密密钥，必须与 createOrder 云函数中的 ID_ENC_SECRET 完全一致
// ⚠️ 上线前必须修改，并在两个云函数的环境变量中设置相同的 ID_ENC_SECRET
const ID_ENC_SECRET = process.env.ID_ENC_SECRET || 'flyride-default-secret-change-me';
const ID_ENC_KEY = crypto.createHash('sha256').update(ID_ENC_SECRET).digest();

function decryptIdNo(enc) {
  try {
    const [ivB64, dataB64] = String(enc).split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ID_ENC_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    return '';
  }
}

function maskIdNo(idNo) {
  if (!idNo || idNo.length < 8) return '****';
  return `${idNo.slice(0, 4)}${'*'.repeat(idNo.length - 8)}${idNo.slice(-4)}`;
}

exports.main = async (event) => {
  const { orderId, staffCode, action = 'confirm' } = event;

  if (!staffCode || staffCode !== STAFF_PASSCODE) {
    return { error: '工作人员口令错误' };
  }
  if (!orderId) return { error: '缺少 orderId' };

  try {
    const { data: order } = await db.collection('fly_orders').doc(orderId).get();
    const riderIdNoMasked = maskIdNo(decryptIdNo(order.riderIdNo));

    // 查询模式：只返回信息供工作人员核对，不修改订单状态
    if (action === 'lookup') {
      return {
        success: true,
        riderName: order.riderName,
        riderPhone: order.riderPhone,
        riderIdNoMasked,
        status: order.status,
      };
    }

    if (order.status !== 'exp_paid') {
      return { error: `订单状态不可核销: ${order.status}` };
    }

    await db.collection('fly_orders').doc(orderId).update({
      data: {
        status: 'completed',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { success: true, riderName: order.riderName, riderIdNoMasked };
  } catch (e) {
    return { error: e.message || '订单不存在' };
  }
};
