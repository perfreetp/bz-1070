import { Response } from 'express';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
  requestId?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function successResponse<T>(res: Response, data: T, message: string = 'success', code: number = 200): Response<ApiResponse<T>> {
  return res.status(code).json({
    code,
    message,
    data,
    timestamp: Date.now()
  });
}

export function errorResponse(res: Response, error: AppError | Error): Response<ApiResponse> {
  const statusCode = (error as AppError).statusCode || 500;
  const isOperational = (error as AppError).isOperational || false;
  const errorCode = (error as AppError).code;

  const response: ApiResponse = {
    code: statusCode,
    message: isOperational ? error.message : 'Internal Server Error',
    timestamp: Date.now()
  };

  if (errorCode) {
    (response as any).errorCode = errorCode;
  }

  if ((error as any).details && Array.isArray((error as any).details)) {
    (response as any).details = (error as any).details;
  }

  if (process.env.NODE_ENV === 'development' && !isOperational) {
    (response as any).stack = error.stack;
  }

  return res.status(statusCode).json(response);
}

export function paginatedResponse<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = 'success'
): Response<ApiResponse<{ items: T[]; total: number; page: number; pageSize: number; totalPages: number }>> {
  const totalPages = Math.ceil(total / pageSize);
  return successResponse(
    res,
    {
      items,
      total,
      page,
      pageSize,
      totalPages
    },
    message
  );
}
