/** Framework-free primitives shared by services and auth: importable from
 *  tests and scripts without pulling in next/headers. */

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  phone: string;
  fullName: string | null;
  roles: string[];
  seedOwnerId: string | null;
}
