import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`Error occurred in path: ${req.originalUrl}. \n`, error);
      next(
        createError(
          error instanceof Error
            ? error.message || "An unexpected error occurred"
            : "An unexpected error occurred",
          500,
          `Error in handler at path: ${req.originalUrl}`
        )
      );
    });
  };
};

export const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  return next();
};
interface SQLError extends Error {
  code: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: number | string;
  path?: string;
  value?: string;
  errors?: Record<string, any>;
  details?: string;
}

function isSQLError(error: Error): error is SQLError {
  return "code" in error && typeof (error as SQLError).code === "string";
}

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err as AppError;
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";

  if (process.env.NODE_ENV === "development")
    return sendDevError(handleError(error), res);

  return sendProdError(handleError(error), res);
};

const handleError = (err: Error): AppError => {
  if (err.name === "JsonWebTokenError")
    return createError("Invalid token. Please log in again.", 401);
  if (err.name === "TokenExpiredError")
    return createError("Your token has expired. Please log in again.", 401);

  if (isSQLError(err)) {
    return createError("SQL Database Error: " + err.sqlMessage, 500);
  }

  return err as AppError;
};

const sendDevError = (err: AppError, res: Response) => {
  let message = err.message;

  return res.status(err.statusCode || 500).json({
    success: false,
    error: err,
    message: `${message}`,
    stack: err.stack,
    details: err.details,
  });
};

const sendProdError = (err: AppError, res: Response) => {
  console.log("sendProdError \n", err);
  return res.status(err.statusCode || 500).json({
    success: false,
    message: `${err.message}`,
  });
};

export const createError = (
  message: string,
  statusCode: number,
  details?: string
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
  error.isOperational = true;
  error.details = details;
  return error;
};

export default errorHandler;
