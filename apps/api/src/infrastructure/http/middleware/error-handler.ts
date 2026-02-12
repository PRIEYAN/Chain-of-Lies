/**
 * Global error handling middleware
 */
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../../logging/logger";

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(`Error: ${message}`, err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
    },
  });
};
