// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, InstanceInfo } from "@/state/store";
import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({
  api: vi.fn(async (path: string) => ({ auth: { phase: "waiting", flowId: path, authorizationUrl: null } })),
  state: { instances: [] as InstanceInfo[], bots: [] as Bot[], config: {} as Record<string, unknown> },
}));
vi.mock("@/state/store", async (original) => ({
  ...await original<typeof import("@/state/store")>(),
  useStore: () => ({ state: fixture.state, dispatch: () => {}, refreshInstances: async () => {}, refreshModels: async () => {} }),
  api: fixture.api,
}));
import { EnginesSettings } from "./EnginesSettings";

function codex(): InstanceInfo {
  return {
    instanceId: "codex", driverKind: "codex", displayName: "Codex", cliDefault: "codex",
    snapshot: { state: "available", authenticated: true, chatgptPlan: true }, models: { default: "gpt", options: [] },
  } as InstanceInfo;
}
function claude(): InstanceInfo {
  return {
    instanceId: "claude", driverKind: "claudeAgent", displayName: "Claude", cliDefault: "claude",
    snapshot: { state: "available", authenticated: true }, models: { default: "claude", options: [] },
  } as InstanceInfo;
}

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLocale("en");
  fixture.api.mockClear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const render = async (instances: InstanceInfo[]) => {
  fixture.state = { instances, bots: [], config: {} };
  await act(async () => { root.render(createElement(EnginesSettings)); });
};

describe("Settings → Codex accounts", () => {
  it("says bots follow the person's own Codex setup", async () => {
    await render([codex()]);
    const notes = container.querySelectorAll("[data-accounts='chatgpt'] ~ [data-codex-shared-setup]");
    expect(notes).toHaveLength(1);
    expect(notes[0]!.textContent).toContain("your own Codex setup");
    expect(notes[0]!.textContent).toContain("not your own instructions (AGENTS.md)");
  });

  it("offers native Codex accounts independently of the ChatGPT plan flow", async () => {
    const native = codex();
    native.snapshot.chatgptPlan = undefined;
    native.authentication = { method: "device-code" };
    await render([native]);
    const add = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Add a Codex CLI account"));
    expect(add).toBeDefined();
    await act(async () => { add!.click(); });
    expect(container.querySelector('[data-add-account="/api/instances/codex-accounts"]')).not.toBeNull();
    expect(container.querySelector("[data-codex-shared-setup]")).toBeNull();
  });

  it("keeps both native sign-in flows visible when started from the same card", async () => {
    const accounts = ["codex-account-plus", "codex-account-free"].map(instanceId => ({
      ...codex(), instanceId, displayName: instanceId,
      snapshot: { state: "available" as const, authenticated: false },
      authentication: { method: "device-code" as const },
    }));
    await render(accounts);
    for (const account of accounts) {
      const row = container.querySelector(`[data-account="${account.instanceId}"]`)!;
      const signIn = Array.from(row.querySelectorAll("button")).find(button => button.textContent === "Sign in")!;
      await act(async () => { signIn.click(); });
    }
    expect(container.querySelectorAll("[data-device-sign-in='codex']")).toHaveLength(2);
    for (const account of accounts) expect(fixture.api).toHaveBeenCalledWith(
      `/api/instances/${account.instanceId}/auth/start`, { method: "POST" });
  });

  it("keeps the note off other engines' account cards", async () => {
    await render([claude()]);
    expect(container.querySelector("[data-codex-shared-setup]")).toBeNull();
  });
});
