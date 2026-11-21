import type { EmailProvider, SendEmailInput, SendEmailResult } from './email-provider.interface.js';

type ResendResponse = {
  id?: unknown;
  message?: unknown;
  name?: unknown;
};

export type ResendEmailProviderOptions = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly options: ResendEmailProviderOptions) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const replyTo = this.options.replyTo?.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const responseText = await response.text();
    const data = parseResponse(responseText);
    if (!response.ok) {
      throw new Error(`Resend ${response.status}: ${getErrorMessage(data, responseText)}`);
    }
    if (typeof data.id !== 'string' || !data.id) {
      throw new Error('Resend returned a successful response without a message id');
    }
    return { messageId: data.id };
  }
}

function parseResponse(value: string): ResendResponse {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ResendResponse) : {};
  } catch {
    return {};
  }
}

function getErrorMessage(data: ResendResponse, fallback: string) {
  if (typeof data.message === 'string') return data.message.slice(0, 500);
  if (typeof data.name === 'string') return data.name.slice(0, 500);
  return fallback.slice(0, 500) || 'Unknown provider error';
}
