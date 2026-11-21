import { BlockList, isIP } from 'node:net';
import type { RequestHandler } from 'express';
import { ForbiddenException } from '../common/http-exceptions.js';

const loopback = new BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  const family = isIP(ip);
  return family !== 0 && loopback.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

function isLocalUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const { hostname, protocol } = new URL(value);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export const requireLocalClient: RequestHandler = (req, _res, next) => {
  const forwardedFor = req.get('x-forwarded-for');
  const origin = req.get('origin');
  if (
    !isLoopback(req.socket.remoteAddress) ||
    req.get('cf-connecting-ip') !== undefined ||
    (forwardedFor !== undefined && !forwardedFor.split(',').every((ip) => isLoopback(ip.trim()))) ||
    !isLocalUrl(`http://${req.get('host')}`) ||
    (origin !== undefined && !isLocalUrl(origin))
  ) {
    throw new ForbiddenException('Developer tools are only available to local clients');
  }
  next();
};
