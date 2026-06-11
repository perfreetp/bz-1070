import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const DEFAULT_SECRET = 'default-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (JWT_SECRET === DEFAULT_SECRET) {
  console.warn('[SECURITY WARNING] Using default JWT secret. Please set JWT_SECRET in .env for production!');
}

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10) || 10;

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  organizationId?: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256'
  });
}

export function verifyToken(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password input');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
