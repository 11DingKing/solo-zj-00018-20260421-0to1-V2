import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JwtPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export const generateToken = (userId: Types.ObjectId, username: string, isAdmin: boolean): string => {
  return jwt.sign(
    { userId: userId.toString(), username, isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
};
