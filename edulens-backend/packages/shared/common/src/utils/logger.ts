/**
 * Structured logging utility
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName?: string) {
    this.serviceName = serviceName || process.env.SERVICE_NAME || 'edulens';
    this.minLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
  }

  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    return LogLevel[normalized as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.minLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context,
      // Add AWS Lambda context if available
      ...(process.env.AWS_REQUEST_ID && {
        requestId: process.env.AWS_REQUEST_ID,
      }),
      ...(process.env._X_AMZN_TRACE_ID && {
        traceId: process.env._X_AMZN_TRACE_ID,
      }),
    };

    return JSON.stringify(log);
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatLog(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = {
        ...context,
        ...(error && {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }),
      };
      console.error(this.formatLog(LogLevel.ERROR, message, errorContext));
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Factory function for service-specific loggers
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}
