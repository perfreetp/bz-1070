import { Request, Response, NextFunction } from 'express';
import { AppError, errorResponse, ApiResponse } from '../utils/response';

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response<ApiResponse> {
  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', err);
  }

  return errorResponse(res, err);
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms ${ip}`);
    }
  });

  next();
}
