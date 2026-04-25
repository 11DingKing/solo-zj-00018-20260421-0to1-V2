import { Context, Next } from 'hono';
import { verifyToken } from '../utils/jwt';
import { Types } from 'mongoose';

export interface AuthVariables {
  userId: Types.ObjectId;
  username: string;
  isAdmin: boolean;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(token);
  
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  c.set('userId', new Types.ObjectId(payload.userId));
  c.set('username', payload.username);
  c.set('isAdmin', payload.isAdmin);
  
  await next();
};

export const adminMiddleware = async (c: Context, next: Next) => {
  const isAdmin = c.get('isAdmin');
  
  if (!isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  await next();
};
