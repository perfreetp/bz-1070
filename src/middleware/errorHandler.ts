import { Request, Response, NextFunction } from 'express';
import { AppError, errorResponse, ApiResponse } from '../utils/response';

const SENSITIVE_ERROR_PATTERNS = [
  /sequelize/i,
  /database/i,
  /sql/i,
  /constraint/i,
  /violation/i,
  /syntax.*error/i,
  /ENOENT/i,
  /undefined/i,
  /TypeError/i,
  /ReferenceError/i
];

function sanitizeErrorMessage(err: Error, isOperational: boolean): string {
  if (isOperational) return err.message;
  if (process.env.NODE_ENV === 'development') return err.message;
  for (const pattern of SENSITIVE_ERROR_PATTERNS) {
    if (pattern.test(err.message) || pattern.test(err.name)) {
      return 'Internal Server Error';
    }
  }
  return err.message || 'Internal Server Error';
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(`Route not found`, 404, 'NOT_FOUND');
  next(error);
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response<ApiResponse> {
  const isOperational = (err as AppError).isOperational || false;

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  } else if (!isOperational) {
    console.error('[SERVER ERROR]', {
      name: err.name,
      message: err.message,
      url: req.originalUrl
    });
  }

  const safeError: AppError = new AppError(
    sanitizeErrorMessage(err, isOperational),
    (err as AppError).statusCode || 500,
    (err as AppError).code
  );
  (safeError as any).isOperational = isOperational;
  if ((err as any).details) {
    (safeError as any).details = (err as any).details;
  }
  safeError.stack = err.stack;

  return errorResponse(res, safeError);
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

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason, promise?.toString?.() || '');
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', error?.message, error?.stack);
});
