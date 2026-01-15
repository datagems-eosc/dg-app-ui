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

export const logApiError = (
  operation: string,
  error: any,
  details?: Record<string, any>,
) => {
  apiLogger.error(
    {
      operation,
      type: "error",
      error: error?.message || error,
      ...details,
    },
    `API Error: ${operation}`,
  );
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
