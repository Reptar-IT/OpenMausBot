import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.ts";
import { decodeRoutedCodexConfig, type CodexEndpointConfig } from "./codex-endpoint-config.ts";

export interface CodexConfig {
  cli: string;
  fullAuto: boolean;
  authMode?: "chatgpt-plan" | "codex-account";
  managed?: CodexEndpointConfig;
  endpoint?: CodexEndpointConfig;
}

export function decodeCodexConfig(raw: unknown): CodexConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (o.authMode !== undefined && o.authMode !== "chatgpt-plan" && o.authMode !== "codex-account") throw new Error("Unknown Codex sign-in mode.");
  if (o.authMode && o.managed) throw new Error("ChatGPT plan and Company billing cannot be combined.");
  if (o.endpoint && (o.authMode || o.managed)) throw new Error("Direct API, ChatGPT plan and Company billing cannot be combined.");
  return {
    cli: typeof o.cli === "string" ? o.cli : "codex",
    fullAuto: o.fullAuto === true,
    ...(o.authMode ? { authMode: o.authMode } : {}),
    ...(o.endpoint ? { endpoint: decodeRoutedCodexConfig(o.endpoint as object, "Direct API") } : {}),
    ...(o.managed && typeof o.managed === "object" ? { managed: decodeRoutedCodexConfig(o.managed) } : {}),
  };
}

export function codexAccountHome(instanceId: string): string {
  const home = join(DATA_DIR, "providers", "codex-accounts", createHash("sha256").update(instanceId).digest("hex"));
  mkdirSync(home, { recursive: true, mode: 0o700 });
  return home;
}

export function applyCodexAccountHome(env: NodeJS.ProcessEnv, home: string): void {
  delete env.CODEX_ACCESS_TOKEN;
  delete env.CODEX_API_KEY;
  delete env.OPENAI_BASE_URL;
  env.CODEX_HOME = home;
  env.CODEX_SQLITE_HOME = home;
}
