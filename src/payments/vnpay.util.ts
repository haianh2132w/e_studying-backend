import * as crypto from 'crypto';

// Mã giao dịch: E<id đăng ký>T<mili giây>. Chỉ gồm chữ và số
export function makeTxnRef(enrollmentId: number) {
  return `E${enrollmentId}T${Date.now()}`;
}

export function parseTxnRef(ref: string): number | null {
  const m = /^E(\d{1,9})T\d{10,15}$/.exec(ref);
  return m ? Number(m[1]) : null;
}

export function normalizeIp(ip?: string) {
  if (!ip || ip === '::1') return '127.0.0.1';
  return ip.replace(/^::ffff:/, '');
}

// VNPay yêu cầu giờ Việt Nam (GMT+7), định dạng yyyyMMddHHmmss
function vnTime(d: Date) {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// Sắp xếp theo tên tham số, mã hóa giá trị, đổi %20 thành dấu +
function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
}

function sign(params: Record<string, string>, secret: string) {
  return crypto.createHmac('sha512', secret).update(Buffer.from(buildQuery(params), 'utf-8')).digest('hex');
}

export function buildPaymentUrl(o: {
  baseUrl: string;
  tmnCode: string;
  secret: string;
  returnUrl: string;
  txnRef: string;
  amountVnd: number;
  ip: string;
  orderInfo: string;
}) {
  const now = new Date();
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: o.tmnCode,
    vnp_Amount: String(o.amountVnd * 100), // nhân 100 theo quy định của VNPay
    vnp_CurrCode: 'VND',
    vnp_TxnRef: o.txnRef,
    vnp_OrderInfo: o.orderInfo, // tiếng Việt không dấu, không ký tự đặc biệt
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: o.returnUrl,
    vnp_IpAddr: o.ip,
    vnp_CreateDate: vnTime(now),
    vnp_ExpireDate: vnTime(new Date(now.getTime() + 15 * 60 * 1000)),
  };
  return `${o.baseUrl}?${buildQuery(params)}&vnp_SecureHash=${sign(params, o.secret)}`;
}

// Kiểm tra chữ ký của IPN và return URL, so sánh an toàn về thời gian
export function verifySignature(query: Record<string, string>, secret: string) {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
  void vnp_SecureHashType;
  if (!vnp_SecureHash) return false;
  const expected = Buffer.from(sign(rest, secret));
  const received = Buffer.from(vnp_SecureHash.toLowerCase());
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}