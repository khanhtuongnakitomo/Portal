import { ResendEmailProvider } from './resend-email.provider.js';

describe('ResendEmailProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the Resend API request with the outbox idempotency key', async () => {
    let capturedInput: Parameters<typeof fetch>[0] | undefined;
    let capturedOptions: Parameters<typeof fetch>[1];
    globalThis.fetch = (input, options) => {
      capturedInput = input;
      capturedOptions = options;
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'resend-message-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    };
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      from: 'TNE Portal <booking@example.edu.vn>',
      replyTo: 'support@example.edu.vn',
    });

    const result = await provider.send({
      to: 'manager@example.edu.vn',
      subject: 'Booking created',
      html: '<strong>Booking</strong>',
      text: 'Booking',
      idempotencyKey: 'booking-created:booking-1:manager-1',
    });

    expect(result.messageId).toBe('resend-message-1');
    expect(capturedInput).toBe('https://api.resend.com/emails');
    expect(capturedOptions?.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Idempotency-Key': 'booking-created:booking-1:manager-1',
    });
    const requestBody = capturedOptions?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body');
    const parsedBody: unknown = JSON.parse(requestBody);
    expect(parsedBody).toMatchObject({
      from: 'TNE Portal <booking@example.edu.vn>',
      to: ['manager@example.edu.vn'],
      reply_to: 'support@example.edu.vn',
    });
  });

  it('surfaces Resend API errors without exposing the API key', async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Domain is not verified' }), {
          status: 403,
        }),
      );
    const provider = new ResendEmailProvider({
      apiKey: 're_secret_value',
      from: 'booking@example.edu.vn',
    });

    await expect(
      provider.send({
        to: 'manager@example.edu.vn',
        subject: 'Booking created',
        html: '<strong>Booking</strong>',
        text: 'Booking',
        idempotencyKey: 'booking-created:booking-1:manager-1',
      }),
    ).rejects.toThrow('Resend 403: Domain is not verified');
  });
});
