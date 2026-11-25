import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";
import { request } from "../scripts/mcp-server.ts";
import { removeTempDir } from "./testing/cleanup.ts";

it("runs separate native Codex accounts through a shared implementation and review", async () => {
  const fixture = await launchVerificationServer(process.env, undefined, undefined, undefined, undefined, undefined, ["codex"]);
  const { url, dataDir } = fixture.info;
  const project = realpathSync(mkdtempSync(join(tmpdir(), "omb-codex-project-")));
  const api = (path: string, body?: unknown, method = "POST") => request(path, body === undefined ? {} : { method, body: JSON.stringify(body) }, url) as Promise<any>;
  const cli = (...args: string[]) => runControlOmb([...args, "--url", url]) as Promise<any>;
  try {
    const provider = join(dataDir, "account-fixture.mjs");
    const planPath = join(dataDir, "review-script.json");
    const trace = join(dataDir, "native-homes.jsonl");
    const fake = pathToFileURL(fileURLToPath(new URL("./testing/fake-codex-app-server.ts", import.meta.url))).href;
    writeFileSync(provider, `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
const home = process.env.CODEX_HOME;
const named = home?.startsWith(${JSON.stringify(join(dataDir, "providers", "codex-accounts") + sep)});
const [command, arg] = process.argv.slice(2);
if (named) {
  if (process.env.CODEX_SQLITE_HOME !== home || process.env.OPENAI_API_KEY || process.env.CODEX_ACCESS_TOKEN) throw new Error("Account environment was not isolated");
  appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ home, command, arg }) + "\\n");
  const auth = join(home, "fixture-account");
  const approved = join(home, "fixture-approved");
  if (command === "login" && arg === "status") {
    console.log(existsSync(auth) ? "Logged in using ChatGPT" : "Not logged in");
    process.exit(existsSync(auth) ? 0 : 1);
  }
  if (command === "login" && arg === "--device-auth") {
    console.log("https://auth.openai.com/codex/device");
    console.log("ABCD-EFGH");
    while (!existsSync(approved)) await new Promise(resolve => setTimeout(resolve, 20));
    writeFileSync(auth, readFileSync(approved, "utf8"), { mode: 0o600 });
    process.exit(0);
  }
  if (command === "logout") {
    unlinkSync(auth);
    process.exit(0);
  }
  if (existsSync(auth)) process.env.FAKE_CODEX_ACCOUNT_EMAIL = readFileSync(auth, "utf8");
}
process.env.FAKE_CODEX_ROOM_PLAN = ${JSON.stringify(planPath)};
process.env.FAKE_CODEX_MODE = "resume";
await import(${JSON.stringify(fake)});
`, { mode: 0o700 });
    await api("/api/instances/codex", { cli: provider }, "PATCH");
    const add = (displayName: string) => api("/api/instances/codex-accounts", { displayName });
    const plus = (await add("Plus engineer")).instanceId as string;
    const free = (await add("Free reviewer")).instanceId as string;
    const accounts = [plus, free];
    const rows = async () => (await api("/api/instances?fresh=1")).instances;
    for (const id of accounts) expect((await rows()).find((row: any) => row.instanceId === id))
      .toMatchObject({ authentication: { method: "device-code" }, snapshot: { authenticated: false } });

    const starts = [];
    for (const id of accounts) starts.push((await api(`/api/instances/${id}/auth/start`, {})).auth);
    expect(starts[0].flowId).not.toBe(starts[1].flowId);
    const homes = [...new Set<string>(readFileSync(trace, "utf8").trim().split("\n")
      .map(line => JSON.parse(line)).filter(event => event.command === "login" && event.arg === "--device-auth").map(event => event.home))];
    expect(homes).toHaveLength(2);
    for (const [index, id] of accounts.entries()) {
      const email = index === 0 ? "plus@example.test" : "free@example.test";
      writeFileSync(join(homes[index], "fixture-approved"), email);
      const status = `/api/instances/${id}/auth/status?flowId=${starts[index].flowId}`;
      await expect.poll(async () => (await api(status)).auth.phase, { timeout: 15_000 }).toBe("succeeded");
      expect((await rows()).find((row: any) => row.instanceId === id).snapshot.account.email).toBe(email);
    }

    const instructions = "Only the engineer edits the implementation. The reviewer verifies the acceptance check.\n";
    const pending = "- [ ] Confirm CSV has a header\n";
    const done = "- [x] Confirm CSV has a header\n";
    writeFileSync(join(project, "AGENTS.md"), instructions);
    writeFileSync(join(project, "PLAN.md"), pending);
    const newBot = async (name: string, instanceId: string, model: string, effort: string) => {
      const { bot } = await cli("new-bot", "--name", name, "--instance", instanceId, "--model", model, "--effort", effort);
      await api(`/api/bots/${bot.id}`, { cwd: project, approvalMode: "full", applyToAllThreads: true }, "PATCH");
      return bot;
    };
    const engineer = await newBot("Fixture Engineer", plus, "gpt-fake-default", "high");
    const reviewer = await newBot("Fixture Reviewer", free, "gpt-page-two", "low");
    const correction = "Add the CSV header, then rerun the acceptance check.";
    const reviewStarted = join(dataDir, "review-started");
    writeFileSync(planPath, JSON.stringify({
      [engineer.id]: { turns: [
        { gateFile: reviewStarted, expectFiles: { "AGENTS.md": instructions, "PLAN.md": pending }, steps: [{ arguments: { bot_ids: [reviewer.id], message: "Review PLAN.md and report required corrections." } }], reply: "Review requested." },
        { expectContextIncludes: [correction], writeFiles: { "export.csv": "name\nAda\n" },
          steps: [
            { arguments: { bot_ids: [reviewer.id], message: "Thanks." }, expectError: true },
            { arguments: { bot_ids: [reviewer.id], message: "Verify the corrected export and acceptance evidence.", rework: true } },
          ], reply: "Verification requested." },
        { expectContextIncludes: ["Header verified independently."], expectFiles: { "VERIFY.md": "Header verified.\n" },
          writeFiles: { "PLAN.md": done }, reply: "Plan completed with independent evidence." },
      ] },
      [reviewer.id]: { turns: [
        { readyFile: reviewStarted, expectFiles: { "AGENTS.md": instructions, "PLAN.md": pending }, reply: correction },
        { gateFile: join(project, "export.csv"), expectFiles: { "export.csv": "name\nAda\n" }, writeFiles: { "VERIFY.md": "Header verified.\n" }, reply: "Header verified independently." },
      ] },
    }));
    await cli("send", "--bot", engineer.id, "--task", engineer.activeTaskId, "--text", "Complete PLAN.md with an independent review.");
    const wait = await cli("wait", "--bot", engineer.id, "--task", engineer.activeTaskId, "--timeout", "40");
    const messages = await cli("messages", "--bot", engineer.id, "--task", engineer.activeTaskId);
    const evidencePath = `${fixture.info.logPath}.accounts.json`;
    writeFileSync(evidencePath, JSON.stringify({ wait, messages }, null, 2), { mode: 0o600 });
    console.info(JSON.stringify({ logPath: fixture.info.logPath, evidencePath }));
    expect(wait.status).toBe("settled");
    expect(readFileSync(join(project, "PLAN.md"), "utf8")).toBe(done);
    expect(readFileSync(join(project, "VERIFY.md"), "utf8")).toBe("Header verified.\n");
    const evidence = readFileSync(`${planPath}.evidence.jsonl`, "utf8").trim().split("\n").map(line => JSON.parse(line));
    expect(evidence.filter(turn => turn.botId === engineer.id)).toMatchObject(
      Array.from({ length: 3 }, () => ({ cwd: project, codexHome: homes[0], sqliteHome: homes[0], effort: "high" })));
    expect(evidence.filter(turn => turn.botId === reviewer.id)).toMatchObject(
      Array.from({ length: 2 }, () => ({ cwd: project, codexHome: homes[1], sqliteHome: homes[1], effort: "low" })));
    expect(evidence.find(turn => turn.botId === engineer.id).model).toBe("gpt-fake-default");
    expect(evidence.find(turn => turn.botId === reviewer.id).model).toBe("gpt-page-two");

    await api(`/api/instances/${free}/auth/sign-out`, {});
    const final = await rows();
    expect(final.find((row: any) => row.instanceId === free).snapshot.authenticated).toBe(false);
    expect(final.find((row: any) => row.instanceId === plus).snapshot.account.email).toBe("plus@example.test");
  } finally {
    await fixture.close();
    await removeTempDir(project);
  }
}, 90_000);
