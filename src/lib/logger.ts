import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  browser: {
    asObject: true,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

export const apiLogger = logger.child({ module: "API" });

export const logApiRequest = (
  operation: string,
  details: Record<string, any>,
) => {
  apiLogger.info(
    {
      operation,
      type: "request",
      ...details,
    },
    `API Request: ${operation}`,
  );
};

export const logApiResponse = (
  operation: string,
  details: Record<string, any>,
) => {
  apiLogger.info(
    {
      operation,
      type: "response",
      ...details,
    },
    `API Response: ${operation}`,
  );
};

const safeSerialize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
};

const getErrorDisplay = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "error" in error)
    return String((error as { error?: unknown }).error);
  if (typeof error === "object" && error !== null && "message" in error)
    return String((error as { message?: unknown }).message);
  return String(error);
};

export const logApiError = (
  operation: string,
  error: unknown,
  details?: Record<string, unknown>,
) => {
  try {
    const errorMsg = getErrorDisplay(error);
    const safeDetails =
      details && typeof details === "object"
        ? (safeSerialize(details) as Record<string, unknown>)
        : {};
    const payload = {
      operation,
      type: "error",
      error: errorMsg,
      ...safeDetails,
    };
    apiLogger.error(payload, `API Error: ${operation}`);
  } catch (_fallbackErr) {
    try {
      const errorMsg = getErrorDisplay(error);
      apiLogger.error(
        { operation, type: "error", error: errorMsg },
        `API Error: ${operation}`,
      );
    } catch {
      if (typeof console !== "undefined" && console.error) {
        console.error("[logApiError] Failed to log:", operation, error);
      }
    }
  }
};

// Helper functions for different log levels
export const logInfo = (message: string, details?: Record<string, any>) => {
  logger.info(details || {}, message);
};

export const logError = (
  message: string,
  error?: any,
  details?: Record<string, any>,
) => {
  logger.error(
    {
      error: error?.message || error,
      ...details,
    },
    message,
  );
};

export const logWarn = (message: string, details?: Record<string, any>) => {
  logger.warn(details || {}, message);
};

export const logDebug = (message: string, details?: Record<string, any>) => {
  logger.debug(details || {}, message);
};

export default logger;
