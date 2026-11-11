import { NotificationStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  buildManagerBookingCreatedEmail,
  parseBookingCreatedPayload,
} from './booking-created-email.js';
import type { EmailProvider } from './email-provider.interface.js';

const PROCESSING_TIMEOUT_MS = 5 * 60_000;
const ERROR_LIMIT = 2_000;

export type NotificationWorkerOptions = {
  frontendUrl: string;
  batchSize: number;
  maxAttempts: number;
  pollIntervalMs?: number;
};

export class NotificationWorkerService {
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailProvider,
    private readonly options: NotificationWorkerOptions,
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 15_000;
  }

  start() {
    if (this.timer) return;
    void this.processPending().catch((error: unknown) => {
      console.error('Initial email outbox processing failed', error);
    });
    this.timer = setInterval(() => {
      void this.processPending().catch((error: unknown) => {
        console.error('Email outbox processing failed', error);
      });
    }, this.pollIntervalMs);
    this.timer.unref();
    console.info(`Email notification worker started (poll every ${this.pollIntervalMs}ms)`);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.activeRun;
  }

  processPending(): Promise<void> {
    if (this.activeRun) return this.activeRun;
    const run = this.run().finally(() => {
      if (this.activeRun === run) this.activeRun = null;
    });
    this.activeRun = run;
    return run;
  }

  private async run() {
    await this.recoverStaleClaims();
    const items = await this.claimBatch();
    for (const item of items) {
      await this.deliver(item);
    }
  }

  private async recoverStaleClaims() {
    const staleBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
    await this.prisma.$transaction([
      this.prisma.notificationOutbox.updateMany({
        where: {
          status: NotificationStatus.PROCESSING,
          lockedAt: { lt: staleBefore },
          attempts: { lt: this.options.maxAttempts },
        },
        data: {
          status: NotificationStatus.PENDING,
          lockedAt: null,
          nextAttemptAt: new Date(),
          lastError: 'Recovered after an interrupted delivery attempt',
        },
      }),
      this.prisma.notificationOutbox.updateMany({
        where: {
          status: NotificationStatus.PROCESSING,
          lockedAt: { lt: staleBefore },
          attempts: { gte: this.options.maxAttempts },
        },
        data: {
          status: NotificationStatus.FAILED,
          lockedAt: null,
          lastError: 'Delivery process stopped after the maximum number of attempts',
        },
      }),
    ]);
  }

  private claimBatch() {
    return this.prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "app"."notification_outbox"
        WHERE "status" = 'PENDING'::"app"."NotificationStatus"
          AND "attempts" < ${this.options.maxAttempts}
          AND "next_attempt_at" <= CURRENT_TIMESTAMP
        ORDER BY "created_at" ASC
        LIMIT ${this.options.batchSize}
        FOR UPDATE SKIP LOCKED
      `);
      if (!ids.length) return [];
      const claimedIds = ids.map(({ id }) => id);
      const lockedAt = new Date();
      await tx.notificationOutbox.updateMany({
        where: { id: { in: claimedIds }, status: NotificationStatus.PENDING },
        data: {
          status: NotificationStatus.PROCESSING,
          attempts: { increment: 1 },
          lockedAt,
        },
      });
      return tx.notificationOutbox.findMany({
        where: { id: { in: claimedIds }, status: NotificationStatus.PROCESSING, lockedAt },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  private async deliver(
    item: Awaited<ReturnType<NotificationWorkerService['claimBatch']>>[number],
  ) {
    try {
      const payload = parseBookingCreatedPayload(item.payload);
      const email = buildManagerBookingCreatedEmail(payload, this.options.frontendUrl);
      const result = await this.emailProvider.send({
        to: item.recipientEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: item.dedupeKey,
      });
      await this.prisma.notificationOutbox.updateMany({
        where: { id: item.id, status: NotificationStatus.PROCESSING },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
          providerMessageId: result.messageId,
        },
      });
    } catch (error) {
      const finalFailure = item.attempts >= this.options.maxAttempts;
      await this.prisma.notificationOutbox.updateMany({
        where: { id: item.id, status: NotificationStatus.PROCESSING },
        data: {
          status: finalFailure ? NotificationStatus.FAILED : NotificationStatus.PENDING,
          lockedAt: null,
          nextAttemptAt: finalFailure ? item.nextAttemptAt : nextRetryAt(item.attempts),
          lastError: toErrorMessage(error).slice(0, ERROR_LIMIT),
        },
      });
      console.warn(
        `Email ${item.id} attempt ${item.attempts}/${this.options.maxAttempts} failed: ${toErrorMessage(error)}`,
      );
    }
  }
}

function nextRetryAt(attempt: number) {
  const delay = Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 6 * 60 * 60_000);
  return new Date(Date.now() + delay);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
