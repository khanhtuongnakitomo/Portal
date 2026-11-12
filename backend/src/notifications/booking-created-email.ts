export type BookingCreatedEmailPayload = {
  bookingId: string;
  title: string;
  purpose: string;
  attendeeCount: number;
  startTime: string;
  endTime: string;
  timezone: string;
  roomName: string;
  roomLocation: string;
  requesterName: string;
  requesterEmail: string;
  studentCode: string | null;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function buildManagerBookingCreatedEmail(
  payload: BookingCreatedEmailPayload,
  frontendUrl: string,
): RenderedEmail {
  const start = formatDateTime(payload.startTime, payload.timezone);
  const end = formatDateTime(payload.endTime, payload.timezone);
  const managerUrl = new URL(ensureTrailingSlash(frontendUrl));
  managerUrl.hash = '/manager';
  const bookingUrl = managerUrl.toString();
  const studentIdentity = payload.studentCode
    ? `${payload.requesterName} (${payload.studentCode})`
    : payload.requesterName;
  const subject = `[TNE Portal] Booking mới chờ duyệt — ${payload.roomName}`;
  const text = [
    'Có một yêu cầu đặt phòng mới đang chờ duyệt.',
    '',
    `Người đặt: ${studentIdentity}`,
    `Email: ${payload.requesterEmail}`,
    `Phòng: ${payload.roomName} — ${payload.roomLocation}`,
    `Thời gian: ${start} đến ${end}`,
    `Số người: ${payload.attendeeCount}`,
    `Tiêu đề: ${payload.title}`,
    `Mục đích: ${payload.purpose}`,
    '',
    `Xem và duyệt booking: ${bookingUrl}`,
  ].join('\n');

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
        <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;letter-spacing:.06em">TNE PORTAL</p>
        <h1 style="margin:0 0 20px;font-size:24px">Booking mới chờ duyệt</h1>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${row('Người đặt', studentIdentity)}
          ${row('Email', payload.requesterEmail)}
          ${row('Phòng', `${payload.roomName} — ${payload.roomLocation}`)}
          ${row('Bắt đầu', start)}
          ${row('Kết thúc', end)}
          ${row('Số người', String(payload.attendeeCount))}
          ${row('Tiêu đề', payload.title)}
          ${row('Mục đích', payload.purpose)}
        </table>
        <p style="margin:28px 0 0">
          <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Xem và duyệt booking</a>
        </p>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px">Email tự động từ TNE Portal. Không chia sẻ thông tin booking ra bên ngoài đội ngũ quản lý.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function parseBookingCreatedPayload(value: unknown): BookingCreatedEmailPayload {
  if (!isRecord(value)) throw new Error('Notification payload must be an object');
  const requiredStrings = [
    'bookingId',
    'title',
    'purpose',
    'startTime',
    'endTime',
    'timezone',
    'roomName',
    'roomLocation',
    'requesterName',
    'requesterEmail',
  ] as const;
  for (const key of requiredStrings) {
    if (typeof value[key] !== 'string') throw new Error(`Notification payload.${key} is invalid`);
  }
  if (!Number.isInteger(value.attendeeCount) || (value.attendeeCount as number) < 1) {
    throw new Error('Notification payload.attendeeCount is invalid');
  }
  if (value.studentCode !== null && typeof value.studentCode !== 'string') {
    throw new Error('Notification payload.studentCode is invalid');
  }
  return value as BookingCreatedEmailPayload;
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
}

function row(label: string, value: string) {
  return `<tr><td style="padding:8px 12px 8px 0;color:#64748b;vertical-align:top;width:120px">${escapeHtml(label)}</td><td style="padding:8px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
