import {
  escapeHtml,
  formatDateTime,
  portalUrl,
  row,
  type RenderedEmail,
} from './email-template.js';

export type BookingDecisionEmailPayload = {
  bookingId: string;
  status: 'APPROVED' | 'REJECTED';
  title: string;
  roomName: string;
  roomLocation: string;
  startTime: string;
  endTime: string;
  timezone: string;
  requesterName: string;
  reviewNote: string | null;
};

export function buildStudentBookingDecisionEmail(
  payload: BookingDecisionEmailPayload,
  frontendUrl: string,
): RenderedEmail {
  const approved = payload.status === 'APPROVED';
  const heading = approved ? 'Đặt phòng đã được duyệt' : 'Đặt phòng không được duyệt';
  const introduction = approved
    ? 'Yêu cầu đặt phòng của bạn đã được duyệt. Vui lòng kiểm tra thông tin bên dưới và sử dụng phòng đúng khung giờ.'
    : 'Yêu cầu đặt phòng của bạn hiện không được chấp thuận. Khung giờ này không còn được giữ cho bạn.';
  const instructions = approved
    ? 'Vui lòng mang theo thẻ sinh viên và mở digital pass trong mục Đặt phòng của tôi trên Portal khi đến phòng Manager nhận chìa khóa. Giữ gìn phòng, trang thiết bị và trả chìa khóa sau khi kết thúc.'
    : 'Bạn có thể chọn phòng hoặc thời gian khác trên Portal và gửi yêu cầu mới. Nếu cần làm rõ lý do, vui lòng liên hệ Manager để được hỗ trợ.';
  const noteLabel = approved ? 'Ghi chú từ quản lý' : 'Lý do';
  const note =
    payload.reviewNote?.trim() ||
    (approved
      ? ''
      : 'Quản lý chưa cung cấp lý do cụ thể. Vui lòng liên hệ Manager để được hỗ trợ.');
  const details = [
    ['Mã yêu cầu', payload.bookingId],
    ['Hoạt động', payload.title],
    ['Phòng', `${payload.roomName} — ${payload.roomLocation}`],
    ['Bắt đầu', formatDateTime(payload.startTime, payload.timezone)],
    ['Kết thúc', formatDateTime(payload.endTime, payload.timezone)],
    ...(note ? [[noteLabel, note]] : []),
  ];
  const url = portalUrl(frontendUrl, '/student');
  const cta = approved ? 'Xem booking trong Portal' : 'Chọn lịch và đặt phòng lại';
  const text = [
    `Chào ${payload.requesterName},`,
    '',
    introduction,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    instructions,
    '',
    `${cta}: ${url}`,
    '',
    'Trân trọng,',
    'Ban quản lý phòng học TNE',
  ].join('\n');

  return {
    subject: `[TNE Portal] ${heading} — ${payload.roomName}`,
    text,
    html: `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
        <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;letter-spacing:.06em">TNE PORTAL</p>
        <h1 style="margin:0 0 20px;font-size:24px;color:${approved ? '#0f766e' : '#b45309'}">${heading}</h1>
        <p>Chào ${escapeHtml(payload.requesterName)},</p>
        <p style="line-height:1.6">${introduction}</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${details.map(([label, value]) => row(label, value)).join('\n')}
        </table>
        <p style="line-height:1.6">${instructions}</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#003b70;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${cta}</a>
        </p>
        <p>Trân trọng,<br/>Ban quản lý phòng học TNE</p>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px">Email tự động từ TNE Portal. Bạn có thể kiểm tra trạng thái mới nhất trong mục Đặt phòng của tôi.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function parseBookingDecisionPayload(value: unknown): BookingDecisionEmailPayload {
  if (typeof value !== 'object' || value === null)
    throw new Error('Notification payload is invalid');
  const payload = value as Record<string, unknown>;
  for (const key of [
    'bookingId',
    'title',
    'roomName',
    'roomLocation',
    'startTime',
    'endTime',
    'timezone',
    'requesterName',
  ]) {
    if (typeof payload[key] !== 'string') throw new Error(`Notification payload.${key} is invalid`);
  }
  if (payload.status !== 'APPROVED' && payload.status !== 'REJECTED')
    throw new Error('Notification payload.status is invalid');
  if (payload.reviewNote !== null && typeof payload.reviewNote !== 'string')
    throw new Error('Notification payload.reviewNote is invalid');
  const start = Date.parse(payload.startTime as string);
  const end = Date.parse(payload.endTime as string);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error('Notification payload times are invalid');
  try {
    formatDateTime(payload.startTime as string, payload.timezone as string);
  } catch {
    throw new Error('Notification payload.timezone is invalid');
  }
  return payload as BookingDecisionEmailPayload;
}
