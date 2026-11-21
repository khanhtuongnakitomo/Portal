import type { Request, RequestHandler } from 'express';
import { HttpException } from '../common/http-exceptions.js';

const windowMs = 60_000;
const maxWindows = 10_000;

type RateWindow = { attempts: number; expiresAt: number };

export function authRateLimit(limit: number, byEmail = false): RequestHandler {
  const windows = new Map<string, RateWindow>();
  let nextCleanup = 0;

  function sweepExpired(now: number) {
    // Every window has the same duration, so insertion order is also expiration order.
    for (const [key, window] of windows) {
      if (window.expiresAt > now) break;
      windows.delete(key);
    }
  }

  return (req, res, next) => {
    const now = performance.now();
    if (now >= nextCleanup) {
      sweepExpired(now);
      nextCleanup = now + windowMs;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = byEmail ? `${ip}/${loginEmail(req)}` : ip;
    const window = windows.get(key);
    if (!window || window.expiresAt <= now) {
      if (window) windows.delete(key);
      if (windows.size >= maxWindows) {
        sweepExpired(now);
        if (windows.size >= maxWindows) {
          const oldest = windows.keys().next();
          if (!oldest.done) windows.delete(oldest.value);
        }
      }
      windows.set(key, { attempts: 1, expiresAt: now + windowMs });
    } else if (window.attempts >= limit) {
      res.set('Retry-After', String(Math.ceil((window.expiresAt - now) / 1000)));
      return next(
        new HttpException(429, 'Too many attempts; try again later', 'Too Many Requests'),
      );
    } else {
      window.attempts++;
    }
    next();
  };
}

function loginEmail(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email.slice(0, 255);
}
