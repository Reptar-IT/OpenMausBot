# Private build network audit

The default desktop hosts its workspace locally. Application telemetry and the
desktop update feed are absent in this build. Local logs and crash diagnostics
remain useful for debugging and are stored on disk.

| Path | Destination and data | Trigger and control |
| --- | --- | --- |
| Renderer analytics and Electron launch reports | Previously sent event properties, an analytics ID, version, platform and launch/crash stages to `us.i.posthog.com`. The SDK could also load configuration and scripts. | The renderer transport and dependency and the desktop sender are removed. Old analytics preferences cannot enable network reporting. See `src/lib/analytics.ts`, `electron/main.mjs` and the dependency lockfile. |
| Desktop updates | Previously checked GitHub releases under `milind-soni/OpenMausBot` and could fetch release metadata and executable packages from GitHub's asset hosts. The request exposed ordinary connection metadata. | Desktop startup never starts the updater. The private package configuration emits no update provider. A self-hosted server only checks the original release metadata with `OMB_CHECK_UPSTREAM_RELEASES=1`. Manual installs are separate operations. See `electron/main.mjs`, `electron/updater.mjs`, `server/routes/update-check.ts` and `electron-builder.yml`. |
| App icons | Previously sent app domains and requested icon sizes to `www.google.com/s2/favicons` and its `t3.gstatic.com` redirect. | The sidebar and app catalog now use local logos or initials. Opening the local workspace does not send icon lookups. See `src/components/ServiceIcon.tsx` and `src/components/SidebarConnectApps.tsx`. |
| Announcements and bundled model information | Previously fetched public JSON and announcement images under `raw.githubusercontent.com/milind-soni/OpenMausBot`. Feed calls were anonymous and revealed ordinary connection metadata. | The runtime announcement store returns an empty list. The model manifest uses bundled or locally cached data and does not schedule downloads. No launch flag is needed. See `server/announcements/feed.ts`, `shared/announcements.ts` and `server/model-manifest/manifest.ts`. |
| Engine maintenance | npm and vendor release assets receive package, platform or version requests. | Automatic engine upkeep and Codex release discovery are off unless the launch environment explicitly sets `OMB_CHECK_ENGINE_UPDATES=1`. Manual engine installation is still available. Codex inference and model probes request disabled analytics, feedback and startup update checks through CLI config. Claude Code receives its nonessential-traffic opt-out. See `server/engine-updates.ts`, `server/drivers/codex-process.ts` and `server/drivers/codex-update.ts`. |
| Managed desktop accounts, phone relay, connected apps and organization features | `cloud.openmausbot.com` (or configured staging), `accounts.openmausbot.com`, configured organization hosts, the managed Composio broker under `workers.dev`, and configured relay or Cloudflare endpoints. Enrollment can send account identity, machine name, installation/device IDs, public keys, platform and version. Authorized sync, sending a workspace, backups, lending or a tunneled session can carry the data described by that operation. | Desktop managed restore, check-ins, offers, cloud sync and hosted phone routes require `OMB_ENABLE_MANAGED_SERVICES=1` in the desktop launch environment. Previously saved managed entries stay on disk. Manually saved independent servers and manual LAN pairing retain their existing controls. See `electron/main.mjs`, `electron/private-desktop.mjs`, `electron/cloud-account.mjs`, `electron/managed-desktop.mjs`, `electron/managed-composio.mjs` and `electron/companion-account-service.mjs`. |
| Headless remote access | Loopback by default. With explicit LAN or Tailscale settings, traffic goes to paired peers. A configured public domain can contact its certificate authority. Relay and tunnel use their configured operator; pairing and session transport can carry identifiers, public keys and authorized traffic. | Explicit CLI access flags and previously saved CLI access choices are supported. Use `openmausbot serve --local` to ignore a saved remote access choice. Hosting environment variables explicitly authorize a configured server role. See `server/cli.ts`, `server/lan-address.ts`, `server/phone-relay.ts`, `server/tailnet-listener.ts` and `server/cloud-home.ts`. |
| Developer diagnostics | When enabled, a report can include the report summary, version, installation ID, diagnostics, excerpts and optional contact information. Status checks send installation and report IDs. | Transport is off unless the operator supplies a valid `OMB_BUG_REPORT_URL` or enables managed services. Report content originates from an explicit `@devs` request. See `server/host/devs-reports.ts`, `server/devs-report.ts` and `server/devs-report-send.ts`. |
| Codex and other AI engines | Codex subscription sign-in uses OpenAI authentication and ChatGPT/Codex APIs. API engines use the provider URL selected for the bot. Authentication can send authorization codes and account tokens to the issuing provider. Turns can transmit prompts, instructions, relevant history, attachments, project excerpts and tool outputs. Model and identity probes can contact the configured provider. | Choosing an engine, authenticating it and using it for a turn authorizes that provider operation. Separate Codex account homes, model routing, local conversation storage and agent handoff APIs remain in place. See `server/drivers/codex.ts`, `server/drivers/codex-device-auth.ts`, `server/drivers/chatgpt-plan-auth.ts`, and the selected engine adapter. |
| Browser, Git, shell, MCP, and connected tools | Destinations are the visited site, configured Git remote, subprocess destination, connected app/MCP server, approved webhook or explicitly configured service. Git can send refs and objects on push. Tools can send arguments, service credentials and files necessary to carry out their approved request. | Existing permissions and explicit connections still apply. Conversation images from external URLs require a click to load. Electron and the managed Chromium launcher suppress Chromium background networking. See `src/components/AttachmentPreview.tsx`, `server/browser/chrome/flags.ts`, `server/browser/egress/` and `server/drivers/agents-catalog.ts`. |
| Build and distribution | Dependency registries, GitHub and upstream vendor binary mirrors can receive artifact/version requests, source IP and build-client metadata. Release workflows can upload release assets to the repository that runs them, using its scoped token. | These are operator or CI actions, not installed-app startup. Review `package.json`, `pnpm-lock.yaml`, `scripts/build-*`, `scripts/bundle-updater.mjs` and `.github/workflows/` for build-time network policy. |

The private defaults are part of the source and package configuration. A
restart or a legacy analytics preference cannot change them. Put any authorized
launch flags in the environment of the specific service or desktop launcher
that should use them. No existing grants or project files are deleted by
switching those flags off.

These controls govern OpenMausBot and its managed launch arguments. An
authorized external engine, browser page, plugin, native program or unrestricted
shell command can make its own connections. The application does not provide
an operating-system-wide outbound firewall. Configure network isolation
separately when a workspace must enforce destination restrictions even on
arbitrary subprocesses.

## Verification

Run the disposable TCP probe and the two-account Codex workflow.

```sh
pnpm exec vitest run server/privacy-network.e2e.test.ts server/codex-accounts.e2e.test.ts
pnpm typecheck
pnpm lint
```

The TCP probe wraps sockets in the isolated Node server and its Node-backed
fixture programs. It exercises server startup, announcement and engine list
reads, idle and a scripted Codex turn. It records destination hosts and
refuses non-loopback attempts. The test also sends a turn to an explicitly configured loopback model endpoint. Neither fixture uses real provider accounts.

On macOS, Chromium NetLog captured the built renderer in the real Electron
shell through startup, server API reads and 18 seconds idle. After removing
the observed Google favicon lookups, both launches of the same disposable
profile showed only the fixture's loopback origin. An unpacked arm64 macOS
package contained neither `app-update.yml` nor the PostHog SDK or desktop
launch-report module. The package check used local artifacts and did not
sign or publish a release.
