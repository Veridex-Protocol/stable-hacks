type LogLevel = "info" | "warn" | "error";

interface DebugLogOptions {
  level?: LogLevel;
  throttleKey?: string;
  throttleMs?: number;
}

declare global {
  var __stablehacksDebugLogState__: Map<string, number> | undefined;
}

function shouldEmitLog(throttleKey?: string, throttleMs?: number): boolean {
  if (!throttleKey || !throttleMs || throttleMs <= 0) {
    return true;
  }

  const state =
    globalThis.__stablehacksDebugLogState__ ?? (globalThis.__stablehacksDebugLogState__ = new Map());
  const now = Date.now();
  const lastAt = state.get(throttleKey) ?? 0;

  if (now - lastAt < throttleMs) {
    return false;
  }

  state.set(throttleKey, now);
  return true;
}

function formatMeta(meta: Record<string, unknown> | undefined): string {
  if (!meta) {
    return "";
  }

  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return "";
  }

  return entries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

export function debugLog(
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
  options: DebugLogOptions = {},
): void {
  if (!shouldEmitLog(options.throttleKey, options.throttleMs)) {
    return;
  }

  const level = options.level ?? "info";
  const timestamp = new Date().toISOString();
  const details = formatMeta(meta);
  const line = details
    ? `[stablehacks:${scope}] ${message} ${details}`
    : `[stablehacks:${scope}] ${message}`;

  if (level === "warn") {
    console.warn(`${timestamp} ${line}`);
    return;
  }

  if (level === "error") {
    console.error(`${timestamp} ${line}`);
    return;
  }

  console.log(`${timestamp} ${line}`);
}
