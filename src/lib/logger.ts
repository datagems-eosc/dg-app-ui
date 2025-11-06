import pino from "pino";

const isServer = typeof window === "undefined";
const isDevelopment = process.env.NODE_ENV === "development";

const browserConfig = {
  browser: {
    asObject: true,
    write: {
      info: (o: Record<string, unknown>) => {
        console.info(o);
      },
      error: (o: Record<string, unknown>) => {
        console.error(o);
      },
      warn: (o: Record<string, unknown>) => {
        console.warn(o);
      },
      debug: (o: Record<string, unknown>) => {
        console.debug(o);
      },
    },
  },
};

const serverConfig = isDevelopment
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    }
  : {};

const baseLogger = pino({
  level: isDevelopment ? "debug" : "info",
  ...(isServer ? serverConfig : browserConfig),
});

export const logger = baseLogger;

export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

