import pino from "pino";

const logger = pino({
  browser: {
    asObject: false,
  },
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

export { logger };
