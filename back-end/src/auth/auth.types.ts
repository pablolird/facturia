export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
}

// The parts of a Clerk user the app relies on, from either the Backend API or a webhook payload
export interface ClerkIdentity {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
}
