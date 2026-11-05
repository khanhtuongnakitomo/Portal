import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
