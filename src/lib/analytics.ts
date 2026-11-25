export function analyticsEnabled(): boolean {
  return false;
}

export function setAnalyticsEnabled(_enabled: boolean): void {}

export async function initAnalytics(): Promise<void> {}

export function analyticsSurface(): "local" | "server" {
  return globalThis.window?.ogb?.environments ? "local" : "server";
}

export function track(_event: string, _props?: Record<string, unknown>): void {}

const GATE_KEY = "omb-email-gate";
export function emailGateDone(): boolean {
  return Boolean(localStorage.getItem(GATE_KEY));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
