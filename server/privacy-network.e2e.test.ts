import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runControlOmb, verificationServerEnvironment } from "../scripts/control-omb.ts";
import { removeTempDir, waitForExit } from "./testing/cleanup.ts";
import { freePortBlock } from "./testing/ports.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

it("keeps startup, idle, picker reads and a local engine turn on loopback", async () => {
  const port = await freePortBlock([0, 1, 2]);
  const url = `http://127.0.0.1:${port}`;
  let modelTurns = 0;
  const modelApi = createServer((request, response) => {
    if (request.url === "/v1/chat/completions" && request.method === "POST") {
      modelTurns++;
      request.resume();
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end('data: {"choices":[{"index":0,"delta":{"content":"Authorized fixture response."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    } else {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture-model" }] }));
    }
  });
  await new Promise<void>((resolve, reject) => modelApi.once("error", reject).listen(port + 2, "127.0.0.1", resolve));
  const home = mkdtempSync(join(tmpdir(), "omb-privacy-network-"));
  const log = join(home, "connect.jsonl");
  const probe = join(home, "connect.cjs");
  mkdirSync(join(home, "tmp"));
  writeFileSync(probe, `
const { appendFileSync } = require("node:fs");
const { Socket } = require("node:net");
const connect = Socket.prototype.connect;
Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof options === "object" ? options.host : typeof options === "number" ? args[1] : null;
  if (typeof host === "string") {
    appendFileSync(${JSON.stringify(log)}, JSON.stringify({ host, pid: process.pid }) + "\\n");
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error("External socket in private-build fixture");
  }
  return connect.apply(this, args);
};
`);
  writeFileSync(join(home, "config.json"), JSON.stringify({
    features: { smartSetupChoices: false },
    instances: {
      codex: { driver: "codex", config: { cli: join(root, "server/testing/fake-codex-app-server.ts") } },
      authorized: { driver: "openai-compat", config: { url: `http://127.0.0.1:${port + 2}/v1`, key: "fixture-only", model: "fixture-model" } },
      claude: { driver: "claudeAgent", config: { cli: join(root, "server/testing/fake-claude-cli.ts") } },
    },
  }));
  const env = verificationServerEnvironment({}, home, port);
  delete env.OMB_DISABLE_ANNOUNCEMENTS;
  delete env.OMB_DISABLE_MODEL_MANIFEST_FETCH;
  env.NODE_OPTIONS = `--require=${JSON.stringify(probe)}`;
  const child = spawn(process.execPath, ["--experimental-strip-types", join(root, "server/index.ts")], { cwd: root, env, stdio: "ignore" });
  const control = (...args: string[]) => runControlOmb([...args, "--url", url]) as Promise<any>;
  try {
    await expect.poll(async () => {
      try { return ((await (await fetch(`${url}/api/health`)).json()) as { pid: number }).pid; } catch { return null; }
    }, { timeout: 25_000 }).toBe(child.pid);
    const announcements = await fetch(`${url}/api/announcements`);
    expect(announcements.ok).toBe(true);
    expect(await announcements.json()).toMatchObject({ cards: [] });
    expect((await fetch(`${url}/api/instances?fresh=1`)).ok).toBe(true);
    expect(await (await fetch(`${url}/api/updates/check`)).json()).toMatchObject({ available: false });
    const { bot } = await control("new-bot", "--name", "Privacy fixture", "--instance", "codex", "--model", "gpt-fake-default");
    await control("send", "--bot", bot.id, "--task", bot.activeTaskId, "--text", "Reply with a short greeting.");
    expect((await control("wait", "--bot", bot.id, "--task", bot.activeTaskId, "--timeout", "20")).status).toBe("settled");
    expect((await control("messages", "--bot", bot.id, "--task", bot.activeTaskId)).messages.some((message: { text?: string }) => message.text?.includes("fake codex"))).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const { bot: apiBot } = await control("new-bot", "--name", "Authorized endpoint", "--instance", "authorized", "--model", "fixture-model");
    await control("send", "--bot", apiBot.id, "--task", apiBot.activeTaskId, "--text", "Reply through the authorized endpoint.");
    expect((await control("wait", "--bot", apiBot.id, "--task", apiBot.activeTaskId, "--timeout", "20")).status).toBe("settled");
    expect(modelTurns).toBeGreaterThan(0);
    const sockets = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line) as { host: string }) : [];
    expect(sockets.some(row => row.host === "127.0.0.1")).toBe(true);
    expect(sockets.filter(row => !["localhost", "127.0.0.1", "::1"].includes(row.host))).toEqual([]);
  } finally {
    await waitForExit(child, { signal: "SIGTERM" });
    await new Promise<void>(resolve => modelApi.close(() => resolve()));
    await removeTempDir(home);
  }
}, 60_000);
