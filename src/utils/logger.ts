/**
 * Simple logger for MCP stdio environment
 *
 * CRITICAL: MCP uses stdio (stdin/stdout) for JSON-RPC communication.
 * We MUST use console.error() (stderr) to avoid corrupting the MCP protocol!
 *
 * This is a simple wrapper that mimics pino API but uses console.error()
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL as keyof typeof LOG_LEVELS] ?? LOG_LEVELS.info;

function log(level: keyof typeof LOG_LEVELS, msgOrObj: any, msg?: string) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const timestamp = new Date().toISOString();

  if (typeof msgOrObj === 'string') {
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${msgOrObj}`);
  } else if (msg) {
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${msg}`, JSON.stringify(msgOrObj, null, 2));
  } else {
    console.error(`[${timestamp}] [${level.toUpperCase()}]`, JSON.stringify(msgOrObj, null, 2));
  }
}

export const logger = {
  debug: (msgOrObj: any, msg?: string) => log('debug', msgOrObj, msg),
  info: (msgOrObj: any, msg?: string) => log('info', msgOrObj, msg),
  warn: (msgOrObj: any, msg?: string) => log('warn', msgOrObj, msg),
  error: (msgOrObj: any, msg?: string) => log('error', msgOrObj, msg),
  fatal: (msgOrObj: any, msg?: string) => log('fatal', msgOrObj, msg)
};
