# 飞行摩托体验预约 · 微信云开发完整项目

## 目录结构

```
flyride/
├── project.config.json              微信开发者工具项目配置
│
├── cloudfunctions/                  ← 所有云函数（后端）
│   ├── createOrder/                 创建订单，生成保险H5链接
│   ├── markInsurancePending/        记录已跳转保险
│   ├── markInsuranceDone/           标记保险完成（前端+Webhook双触发）
│   ├── createPayment/               云调用发起微信支付（无需证书）
│   ├── payNotify/                   微信支付成功回调
│   ├── getOrder/                    查询订单状态（轮询用）
│   └── verifyOrder/                 工作人员核销
│
└── miniprogram/                     ← 小程序前端
    ├── app.js                       云开发初始化 + callCloud封装
    ├── app.json                     页面路由
    ├── app.wxss                     全局样式
    └── pages/
        ├── index/                   首页（费用展示）
        ├── form/                    填写信息页
        ├── insurance/               保险跳转页（流程枢纽）
        └── payment/                 体验费支付页
```

## 云开发与自建服务器的对比

| 项目 | 自建服务器 | 云开发 |
|------|-----------|--------|
| 微信支付签名 | 需手动实现 RSA-SHA256 | ✅ 免签名 |
| API 证书管理 | 需下载 .pem 文件 | ✅ 不需要 |
| openid 获取 | 需 jscode2session 接口 | ✅ 自动注入 |
| 服务器购买 | 需要 | ✅ 不需要 |
| HTTPS 配置 | 需要 | ✅ 不需要 |
| 数据库 | 自建 PostgreSQL | ✅ 云数据库（Mongo） |

## 快速上手

### 1. 前提条件

- [ ] 小程序账号（非个人主体，需企业/个体户）
- [ ] 开通云开发环境（开发者工具 → 云开发 → 开通）
- [ ] 商户号绑定小程序（微信支付商户平台 → 产品中心 → JSAPI支付）

### 2. 修改配置（两处必改）

**project.config.json**
```json
"appid": "你的小程序AppID"
```

**miniprogram/app.js**
```js
cloudEnvId: '你的云开发环境ID'  // 在云开发控制台→环境→环境ID
```

**cloudfunctions/createPayment/index.js**
```js
const CLOUD_ENV_ID = '你的云开发环境ID';
// ...
subMchId: '你的微信支付商户号',
```

### 3. 云开发控制台操作

#### 3.1 创建数据库集合
云开发控制台 → 数据库 → 新建集合：
```
fly_orders
```
权限设置：**仅创建者可读写**

#### 3.2 绑定微信支付商户号
云开发控制台 → 设置 → 全局设置 → 微信支付配置：
- 填入商户号（李叶强注册后的商户号）
- 完成绑定

#### 3.3 开启 markInsuranceDone 的 HTTP 触发
云开发控制台 → 云函数 → markInsuranceDone → 触发方式 → HTTP触发：
- 开启后复制触发 URL
- 将此 URL 提供给保险公司配置 Webhook 回调

### 4. 部署云函数

在微信开发者工具中，对每个云函数目录右键：
**"上传并部署：云端安装依赖（不上传 node_modules）"**

需要部署的函数：
- createOrder
- markInsurancePending
- markInsuranceDone
- createPayment
- payNotify
- getOrder
- verifyOrder

### 5. 配置业务域名（web-view 使用）

小程序后台 → 开发管理 → 开发设置 → 业务域名：
添加 `exx.95505.cn`（保险H5域名）

## 订单状态流转

```
created        游客填信息，订单已创建
  ↓
ins_pending    已跳转保险H5
  ↓
ins_done       保险完成（前端回调 or 保险公司Webhook）
  ↓
exp_paid       体验费支付成功（微信回调触发）
  ↓
completed      工作人员核销，体验完成
```

## 云数据库字段说明

```javascript
{
  _id: 'FR17234567890ABCDEF',   // 订单号（同微信支付 outTradeNo）
  openid: 'o9Kxs...',           // 游客 openid（自动注入）
  riderName: '张三',
  riderPhone: '13812345678',
  riderIdNo: '110101...',        // 建议生产环境加密
  riderWeight: '75',
  status: 'exp_paid',
  insuranceUrl: 'https://exx.95505.cn/...',
  insuranceDoneAt: Date,
  experiencePaidAt: Date,
  wxTransactionId: '4200001234...',  // 微信支付流水号
  paidFee: 19800,                // 实际支付金额（分）
  expireAt: Date,
  createdAt: Date,
  updatedAt: Date,
}
```

## 常见问题

**Q: payNotify 云函数收不到回调？**  
A: 检查 createPayment 中的 `envId` 是否填写正确（需要是环境ID，不是环境名称）。

**Q: cloudPay.unifiedOrder 报错 -501007？**  
A: 云开发控制台没有绑定商户号，或商户号与小程序 AppID 未在微信支付平台完成绑定。

**Q: web-view 加载保险H5失败？**  
A: 需在小程序后台将 `exx.95505.cn` 添加为业务域名白名单。

**Q: 保险完成后没有自动跳回？**  
A: 目前依赖轮询（3秒一次）。若要更快响应，需联系中国人寿95505平台配置 Webhook 回调到 markInsuranceDone 的 HTTP 触发地址。
