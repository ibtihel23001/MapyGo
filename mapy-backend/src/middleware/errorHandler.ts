import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational
    ? err.message
    : env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error';

  if (env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({ success: false, message });
}

/** Convenience factory for operational errors */
export function createError(message: string, statusCode = 400): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
