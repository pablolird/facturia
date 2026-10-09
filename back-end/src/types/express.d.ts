declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        clerkUserId: string;
        username: string;
        email: string;
        role: 'admin' | 'user';
      };
    }
  }
}

export {};
