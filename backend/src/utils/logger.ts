import * as Sentry from '@sentry/node';

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.info(message, meta ?? '');
    Sentry.addBreadcrumb({ message, data: meta, level: 'info' });
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(message, meta ?? '');
    Sentry.addBreadcrumb({ message, data: meta, level: 'warning' });
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    console.error(message, error ?? '', meta ?? '');
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: meta });
    } else if (error) {
      Sentry.captureException(new Error(message), { extra: { ...meta, originalError: error } });
    }
  },
};
