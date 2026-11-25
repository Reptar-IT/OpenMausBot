# Two Codex accounts on one project

In **Settings → AI → ChatGPT**, choose **Add a Codex CLI account**. Name
the profiles, for example **Plus engineer** and **Free reviewer**. Complete
each CLI device sign-in with the corresponding ChatGPT account. OpenAI may
require the account to enable device-code sign-in in its security settings.
Both sign-in panels can stay open. Check the identity displayed on each row
after sign-in. The CLI uses the
selected account's Codex allowance and applies its plan and workspace limits.
Model availability can differ between accounts.

In each bot's **Model** picker, choose **OpenAI**, select the corresponding
named account, and pick a model that account can run. Set **Reasoning** in the
same bot's panel. Models listed by the installed CLI can still be refused by
the selected account or workspace. OpenMausBot does not use another Codex
subscription as a fallback when the selected account reaches its limit.

Choose the same owner-authorized working folder in both bot panels. Store
the owner's `AGENTS.md`, plan and acceptance criteria there. Tell the engineer
to keep the plan current and the reviewer to run the acceptance checks and
record the commands and results in a verification file. Assign the engineer
the changes and ask it to request a review, fix issues the reviewer returns,
and request confirmation before marking the plan complete. Both bots can use
`coordinate_bots` to request work or send findings. Its default reply behavior
returns the result and resumes the requester. Use `rework: true` for a concrete
follow-up to a finished assignment. The existing handoff runtime
bounds assignments, detects cycles and handles Stop and restart recovery.
See [in-chat team coordination](room-coordination.md).

Each added CLI profile has its own `CODEX_HOME` and SQLite state under
`providers/codex-accounts` in the server data directory. The CLI handles its
credentials and the app does not include provider homes in workspace backups.
Removing a profile signs it out through the CLI and leaves its local state
on disk. Configure project access through the existing workspace controls.
The profile folders isolate CLI state. Processes with unrestricted access
under the same operating system user can still read the files that user can read.

## Verification

Run the isolated workflow:

```sh
pnpm exec vitest run server/codex-accounts.e2e.test.ts
```

The test launches the real server with a disposable home, two synthetic CLI
sign-ins and a separate shared project. It checks independent identities and
settings, a review correction, a second review pass, verification evidence
and plan completion. It signs out the reviewer and checks that the engineer
is still signed in.

For live acceptance, launch a disposable fixture with the installed Codex CLI
configured as its executable. Use two accounts signed in specifically for
the fixture. Use a small disposable project and assign the workflow above.
Capture the original thread's `control:omb wait` and `messages` output, the
reviewer's result, and the final plan and evidence. Stop the fixture when
finished. The offline test does not establish a live account's entitlement,
the models it can run or its remaining allowance.
