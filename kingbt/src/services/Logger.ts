type LogLevel = 'info' | 'warn' | 'error' | 'event';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 200;

  private add(level: LogLevel, message: string, meta?: any) {
    const entry: LogEntry = { timestamp: new Date().toISOString(), level, message, meta };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  info(message: string, meta?: any) {
    this.add('info', message, meta);
    if (__DEV__) console.log(`[INFO] ${message}`, meta ?? '');
  }

  warn(message: string, meta?: any) {
    this.add('warn', message, meta);
    if (__DEV__) console.warn(`[WARN] ${message}`, meta ?? '');
  }

  error(message: string, error?: Error, meta?: any) {
    this.add('error', message, {
      ...meta,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    if (__DEV__) console.error(`[ERROR] ${message}`, error, meta ?? '');
  }

  event(name: string, meta?: any) {
    this.add('event', name, meta);
    if (__DEV__) console.log(`[EVENT] ${name}`, meta ?? '');
  }

  getLogs(): LogEntry[] { return [...this.logs]; }
  clearLogs() { this.logs = []; }
}

export const Logger = new LoggerService();
