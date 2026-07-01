function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function isValidIdNo(idNo) {
  return /^\d{17}[\dX]$/i.test(idNo);
}

// 18位身份证第7-14位为出生日期(YYYYMMDD)，据此计算周岁年龄
function calcAgeFromIdNo(idNo) {
  if (!isValidIdNo(idNo)) return null;
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

module.exports = { isValidPhone, isValidIdNo, calcAgeFromIdNo };
