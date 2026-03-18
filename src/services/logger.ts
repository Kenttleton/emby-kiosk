import { File, Paths } from 'expo-file-system';

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_SIZE  = 512 * 1024; // 512 KB
const TRIM_FRAC = 0.2;        // drop oldest 20% of lines when limit is hit

function logFile(): File {
  return new File(Paths.document, 'emby-kiosk.log');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// ─── File I/O ─────────────────────────────────────────────────────────────────

// Serialize writes so concurrent calls never corrupt the file
let writeQueue: Promise<void> = Promise.resolve();

async function appendToFile(entry: string): Promise<void> {
  try {
    const file = logFile();
    let content = file.exists ? await file.text() : '';

    content += entry + '\n';

    if (content.length > MAX_SIZE) {
      const lines = content.split('\n').filter(Boolean);
      const drop  = Math.max(1, Math.ceil(lines.length * TRIM_FRAC));
      content     = lines.slice(drop).join('\n') + '\n';
    }

    file.write(content);
  } catch {
    // File logging must never crash the app
  }
}

function enqueue(entry: string): void {
  writeQueue = writeQueue.then(() => appendToFile(entry));
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function formatArg(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
  try { return JSON.stringify(a); } catch { return String(a); }
}

function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

function log(level: Level, message: string, ...args: unknown[]): void {
  const text  = args.length ? `${message} ${formatArgs(args)}` : message;
  const entry = `${new Date().toISOString()} [${level}] ${text}`;

  if (__DEV__) {
    switch (level) {
      case 'DEBUG': console.debug(entry); break;
      case 'INFO':  console.info(entry);  break;
      case 'WARN':  console.warn(entry);  break;
      case 'ERROR': console.error(entry); break;
    }
  } else {
    enqueue(entry);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  debug: (message: string, ...args: unknown[]) => log('DEBUG', message, ...args),
  info:  (message: string, ...args: unknown[]) => log('INFO',  message, ...args),
  warn:  (message: string, ...args: unknown[]) => log('WARN',  message, ...args),
  error: (message: string, ...args: unknown[]) => log('ERROR', message, ...args),

  async getLogs(): Promise<string> {
    if (__DEV__) return '(Logs are written to the Metro console in development.)';
    try {
      const file = logFile();
      if (!file.exists) return '(No log entries yet.)';
      return await file.text();
    } catch {
      return '(Failed to read log file.)';
    }
  },

  async clearLogs(): Promise<void> {
    if (__DEV__) return;
    try {
      logFile().delete();
    } catch {}
  },

  /** Absolute path to the log file (release only). */
  get filePath(): string {
    return logFile().uri;
  },
};
