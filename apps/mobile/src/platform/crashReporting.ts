import { redact, redactString } from "./redaction";

export type CrashLevel = "info" | "warning" | "error" | "fatal";

export interface CrashReport {
  readonly level: CrashLevel;
  readonly message: string;
  readonly error?: unknown;
  readonly context?: unknown;
  readonly userId?: string;
  readonly at: string;
}

/** Where a provider SDK plugs in. It only ever receives redacted reports. */
export type CrashSink = (report: CrashReport) => void;

export interface CrashReporter {
  captureException(error: unknown, context?: Readonly<Record<string, unknown>>): void;
  captureMessage(message: string, level?: CrashLevel, context?: Readonly<Record<string, unknown>>): void;
  setUser(userId: string | undefined): void;
}

export function createCrashReporter(sink?: CrashSink, now: () => number = Date.now): CrashReporter {
  let userId: string | undefined;

  const send = (report: Omit<CrashReport, "at" | "userId">): void => {
    if (sink === undefined) return;

    try {
      sink({
        level: report.level,
        message: redactString(report.message),
        ...(report.error === undefined ? {} : { error: redact(report.error) }),
        ...(report.context === undefined ? {} : { context: redact(report.context) }),
        ...(userId === undefined ? {} : { userId }),
        at: new Date(now()).toISOString(),
      });
    } catch {
      /* A failing sink never takes the app down. */
    }
  };

  return {
    captureException: (error, context) => {
      send({ level: "error", message: error instanceof Error ? error.message : "Non-error thrown", error, ...(context === undefined ? {} : { context }) });
    },
    captureMessage: (message, level = "info", context) => {
      send({ level, message, ...(context === undefined ? {} : { context }) });
    },
    setUser: (id) => {
      userId = id !== undefined && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : undefined;
    },
  };
}
