import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/auth';
import { AppError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid authorization token', 401, 'AUTH_MISSING'));
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return next(new AppError('Invalid or expired token', 401, 'AUTH_INVALID'));
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Insufficient permissions. Required roles: ${roles.join(', ')}`, 403, 'PERMISSION_DENIED'));
    }

    next();
  };
}

export function deviceAuth(req: Request, res: Response, next: NextFunction): void {
  const deviceToken = req.headers['x-device-token'] || req.headers['device-token'];

  if (!deviceToken) {
    return next(new AppError('Missing device authentication token', 401, 'DEVICE_AUTH_MISSING'));
  }

  (req as any).deviceToken = deviceToken;
  next();
}
