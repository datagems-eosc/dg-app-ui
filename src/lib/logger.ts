import pino from "pino";

// Configure Pino logger for browser/server
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

// API-specific logger
export const apiLogger = logger.child({ module: "API" });

// Helper functions for structured logging
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

export default logger;
