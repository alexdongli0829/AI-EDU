/**
 * Structured logger for admin service
 */

export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      })
    );
  },

  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      })
    );
  },

  error: (message: string, meta?: Record<string, any>) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: meta?.error instanceof Error ? meta.error.message : meta?.error,
        stack: meta?.error instanceof Error ? meta.error.stack : undefined,
        ...meta,
        timestamp: new Date().toISOString(),
      })
    );
  },
};
