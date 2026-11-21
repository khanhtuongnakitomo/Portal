export type RenderedEmail = { subject: string; html: string; text: string };

export function portalUrl(frontendUrl: string, route: '/manager' | '/student') {
  const url = new URL(frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`);
  url.hash = route;
  return url.toString();
}

export function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function row(label: string, value: string) {
  return `<tr><td style="padding:8px 12px 8px 0;color:#64748b;vertical-align:top;width:120px">${escapeHtml(label)}</td><td style="padding:8px 0;font-weight:600;white-space:pre-wrap;overflow-wrap:break-word">${escapeHtml(value)}</td></tr>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
