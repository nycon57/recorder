import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {} // JSON output in production
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export function createLogger(context: string) {
  return baseLogger.child({ context });
}

export default baseLogger;
