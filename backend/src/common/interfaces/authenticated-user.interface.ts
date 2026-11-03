import { Role, UserStatus } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
}
