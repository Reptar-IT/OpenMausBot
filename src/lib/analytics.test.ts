import { expect, it, vi } from "vitest";
import { analyticsEnabled, initAnalytics, setAnalyticsEnabled, track } from "./analytics";

it("keeps legacy analytics calls disabled even when an old caller requests opt-in", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  try {
    setAnalyticsEnabled(true);
    await initAnalytics();
    track("message_sent", { text: "private fixture" });
    expect(analyticsEnabled()).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
