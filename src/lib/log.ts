// Structured server-side logging. One JSON line per event so hosted logs
// (Vercel, Supabase) are grep- and filter-able. Swap the transport for
// Sentry/Axiom later without touching call sites.

type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, event: string, context?: LogContext) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};

// Normalize unknown catch values into loggable context.
export function errorContext(err: unknown): LogContext {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}
