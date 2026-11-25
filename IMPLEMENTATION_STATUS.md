# Multi-Codex accounts

| Requirement | Status |
| --- | --- |
| Named profiles and isolated credentials, configuration and sessions | Added through the native Codex CLI sign-in route and Settings account card. |
| Plus and Free without an API key | Uses the CLI device flow and each selected account's plan. Live sign-in requires the account owner. |
| Per-agent account, model and reasoning | Uses the bot's existing model selection and reasoning controls. Named accounts appear in the OpenAI account selector. |
| Bidirectional actionable requests | Uses the existing assignment runtime, including its cycle limits, Stop and restart handling. |
| Shared project and plan evidence | Uses each bot's authorized working folder and owner-supplied project files. The acceptance scenario includes a returned correction and an independent verification pass. |

## Verification

- The disposable two-account workflow passed with separate sign-ins, homes,
  models and reasoning levels. Both agents ran concurrently. The reviewer
  returned a correction, verified the corrected file and wrote evidence. The
  engineer then completed the plan. The handoff runtime refused an unsolicited
  acknowledgment as repeat work. Signing out the reviewer left the engineer
  signed in.
- Codex credential, backup and end-to-end tests passed (85). Settings
  tests passed (35), including concurrent sign-in panels. Typecheck, lint
  and locale catalog validation passed.
- Live Plus and Free verification is pending owner authentication in the
  disposable fixture. The scripted test does not prove live model entitlement
  or real-model behavior.

See [the setup and verification recipe](docs/verification/multi-codex-accounts.md).
