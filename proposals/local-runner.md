# Run on my machine from the team instance

A proposal to let a person on a team instance run a test, a spec file or a run's failures on their own machine, headed,
and follow that run from the page they started it on. A small local executor, the **runner**, is paired once with the
person's account and takes run requests from the team instance over a connection it opens itself. At the end of the
run, **Raise a ticket** files an issue with the person's own comment and the run attached. It builds on the desktop
app's local runs and repro requests, on the device authorization grant the extension and the editors connect with, and
on the plans of [live-runs.md](live-runs.md) and [desktop-native.md](desktop-native.md). Discussed on
[PiwiTests/piwi#1163](https://github.com/PiwiTests/piwi/issues/1163).

**Status.** Proposed 2026-11-06, against `main` at `d232d9d8`; nothing built. Nothing here is on
[`ROADMAP.md`](../ROADMAP.md) yet. The contracts it would add are entry D64 of
[`1.0-stabilization.md`](1.0-stabilization.md).

**Summary.** On the team instance, a test, a spec file and a run get **Run on my machine**. The request goes to the
person's paired runner, which resolves the tests in the folder the person linked for that project, shows what it will
run, and runs it with the folder's own Playwright once the person confirms. The run reports to the team instance as a
local run, so the page the person clicked from shows a progress panel with **Stop** and **Run again**, and **Watch**
where the live view is on. A `piwi://` link pairs the runner the first time and starts it when it is not running;
every later request goes through the team instance. Nothing in a request is a command, a path or an environment
variable: the runner builds the command itself, as the desktop app does today.

## Terms

- **Team instance**: a Piwi server several people use, where CI reports (Kubernetes, Docker, a VM).
- **Runner**: the local executor on a person's machine. It runs Playwright in a folder the person linked and holds no
  dashboard or database of its own.
- **Pairing**: linking one runner to one person's account on one team instance, once per device.
- **Run request**: what the team instance hands a runner: the tests to run and the options, from a fixed list.
- **Local run**: a run started on a person's machine, which reports to the team instance with its origin set to the
  runner.

## Problem

Tests run on CI and report to the team instance. A person who reads a failure there, or who tests a feature by hand
and wants to see what the automated test does, has no path from that page to their own machine:

- **Run locally** exists only inside the desktop app (`DesktopRunLocallyButton.vue` renders nothing without the IPC
  bridge), and the desktop app knows only its own server, never the team instance.
- To watch one suite run headed, the person installs the whole desktop app (a dashboard, a database, reproduce,
  bisect, Flake Lab, MCP), links a folder, and starts the run from there. The team instance, where the failure is,
  plays no part, and the run it produces is not on it.
- When a run is not what they expected ("a case is missing", "this step is too slow to be useful", "the test passes
  but the feature is broken"), there is nowhere to say so with the run attached: **Create issue** files from a failure
  cluster or a bug report only.

Manual testers are the people most affected. With coding tools, a team ships more changes than its QA people can
check by hand, so they need to run and read the automated tests themselves, without waiting for a developer to run
them.

## What exists to build on

| Piece                 | Where                                                                                | What it gives this plan                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Local runs            | `apps/desktop/src-tauri/src/runner.rs` (`desktop_run_local_tests`)                   | runs the folder's own Playwright with the bundled Node, stops it with a grace period                  |
| Allowed flags         | `runner.rs` (`ALLOWED_FLAGS`, `validate_args`)                                       | the only flags a local run accepts; anything else is refused                                          |
| Project folders       | `runner.rs` (`read_links`, `desktop_set_project_link`), `DesktopFolderChecklist.vue` | a folder per project, kept on the machine; the folder, spec and Playwright checks                     |
| Repro requests        | `shared/desktop-repro.ts`, `/api/desktop/repro-requests`, D36                        | a request that carries tests and commits, never code or flags, kept until the person confirms it      |
| Origin references     | `PIWI_ORIGIN_REF` (D29)                                                              | every local run says what started it                                                                  |
| Device authorization  | `server/utils/extension-connect.ts`, `/api/extension/connect/*`                      | the RFC 8628 grant Piwi Picker and the editors connect with: a user code, a signed-in approval, a key |
| `piwi://` links       | `apps/desktop/src-tauri/src/lib.rs` (`open_links`)                                   | `piwi://open/<page>` opens a page; every other path is refused today                                  |
| Live runs and the hub | [live-runs.md](live-runs.md) P4 to P7, `@piwitests/core/run-hub`                     | the run's progress, **Watch**, the start options (**Run headed**, **Hold failures**)                  |
| Issue filing          | `shared/integrations/`, the integration outbox, `createIssueKey`                     | an issue filed once per entity and connection, through a bound tracker                                |

## Options compared

### How the team instance reaches the runner

|                                             | How it works                                                                                                                                                      | Used by                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **1. A `piwi://` link each time**           | **Run on my machine** opens `piwi://run?…`; Stop and Run again are links too.                                                                                     | Zoom, _Open in VS Code_, Figma                                                      |
| **2. Pair once, then through the instance** | A `piwi://` link (or a code the runner shows) pairs it once. The runner then keeps one outbound connection to the team instance and receives every request on it. | GitHub Actions self-hosted runners, GitLab Runner, Buildkite agents, Jenkins agents |
| **3. The page calls `localhost`**           | The team instance's page fetches `http://127.0.0.1:<port>`.                                                                                                       | Postman's desktop agent                                                             |

- **Option 1** needs no server state, but the browser asks "Open Piwi Runner?" on each click (Safari keeps asking), it
  works only when the browser and the runner share a machine, and Stop is another link.
- **Option 2** asks once. **Run on my machine**, **Stop** and **Run again** are then plain buttons. The runner opens
  no port, so it works behind a VPN or NAT and from any browser of the person's, another device's included. It costs a
  runners table, a request queue, a channel and a page to revoke runners.
- **Option 3** is not proposed: browsers gate a public page's requests to `localhost` (Chrome's local network access
  prompt, Safari's mixed content), and any page the person opens could try the port.

### Where the runner lives

- **A. A runner mode of the desktop app**: the same installer with the dashboard and the database off. The run code,
  the checks and the `piwi://` handler are already there.
- **B. A separate small app, Piwi Runner**: built from the same crate's run code. Smaller to install, and easier to
  approve on a managed laptop, where IT reviews each app; a second release artifact to sign and update.

## Decisions

1. **Option 2, with `piwi://` for the first pairing and to start the runner.** A link is the natural way to pair:
   one click from the page that offers it. After that, a link on every click is a prompt on every click.
2. **B, a separate runner, is recommended; A is acceptable.** The person this serves needs to run a test, not to host
   a dashboard. If a mode of the desktop app fits the maintainer's plans better, every part of this proposal holds
   with "the runner" read as that mode.
3. **The runner asks before every run by default.** A person may turn on _Run without asking_ per project, on the
   machine only.
4. **The team instance never sends a command, a path or an environment variable.** A request names tests and options
   from a fixed list; the runner resolves the tests in its own folder and builds the command.
5. **A run request starts at most one run.** It is claimed once, expires unclaimed, and a retry never starts a second
   run (see [Run requests](#3-run-requests)).
6. **Shared logic stays on the FSL side.** The request schema and its parser live in `apps/application/shared/`
   beside `desktop-repro.ts`, and the runner's code in `apps/desktop/`. Nothing moves into `@piwitests/core`, which is
   MIT.

## Design

### 1. Pairing

Pairing reuses the device authorization grant of `server/utils/extension-connect.ts`, with the runner as its client:

1. The person clicks **Pair a runner** on the team instance (Profile, or the **Run on my machine** menu when no runner
   is paired). The page opens `piwi://pair?instance=<url>` and shows the steps.
2. The runner starts, if needed, and asks in its own window: _Pair with piwi.example.com as you?_ It never pairs from
   the link alone.
3. On **Pair**, the runner starts a device request at the instance (`clientName`: `Piwi Runner on <device name>`) and
   shows the user code. The person enters it on the instance's verification page, which the page of step 1 links to;
   the page names the device, and the person approves.
4. The runner's next poll receives its key. Without `piwi://` (blocked, or a browser on another machine), the person
   opens the runner, picks **Pair** with the instance's address, and enters the code the same way.

The code expires in 10 minutes (`DEVICE_CODE_TTL_MS`) and is used once. `piwi://pair` is a new route of the link
handler: today only `open/` is accepted and a test asserts that any other path returns nothing. The new route only
brings the runner's window forward with the instance named; it pairs nothing until the person confirms there.

### 2. The runner's key and the channel

- **A runner key is scoped.** It reads its own run requests, claims them, writes their status, and sends results as
  the reporter does for that person's projects. It cannot read other users' data, change settings or file issues. It
  is a row of `api_keys` with a new `scope` column set to `runner` (every existing key reads as `full`), listed and
  revoked in **Profile → Connected runners**, each with its device, its last-seen time and **Revoke**.
- **The key lives in the OS keychain** (Keychain, Credential Manager, Secret Service), never in a file.
- **The channel** is one outbound stream from the runner: `GET /api/runners/stream` (server-sent events), with a
  heartbeat; the runner reconnects with backoff, and falls back to polling `GET /api/runners/requests` where a proxy
  cuts long responses. A WebSocket is not needed: requests flow one way, and claims and status are plain requests.

### 3. Run requests

A request is a row of `runner_requests`, created by **Run on my machine** for the signed-in person's own runner:

```ts
interface RunnerRequest {
  id: string; // random, single use
  runnerId: number;
  projectId: number;
  tests: { filePath: string; title: string; line?: number; projectName?: string }[]; // 1 to 200
  options: {
    headed: boolean; // default true
    trace?: "on" | "retain-on-failure";
    repeatEach?: number; // 1 to 10
    workers?: number; // 1 to 4
  };
  origin: { runId?: number; executionId?: number; commit?: string; branch?: string };
  status: "waiting" | "claimed" | "running" | "done" | "declined" | "expired" | "failed";
  expiresAt: Date; // 2 minutes after creation while waiting
}
```

- **Tests** follow D36: `filePath` relative to the Playwright config, no leading `-`, `/` or drive, no `..`. The
  runner checks each against its folder before it shows the confirmation.
- **Options** map onto `ALLOWED_FLAGS`: `--headed`, `--trace`, `--repeat-each`, `--workers`, `--project`. `--ui`,
  `--debug`, `--grep` and `--timeout` are not offered: the first two are the person's to start from their own editor,
  and a free-text grep is a filter the team instance has no reason to send.
- **Claimed once.** `POST /api/runners/requests/:id/claim` moves `waiting` to `claimed` in one conditional update; a
  second claim, from a reconnect or a second runner process, answers 409 and starts nothing. A request not claimed
  within 2 minutes expires, and the page says the runner did not answer.
- **One run per request.** The runner records the request id with the run it starts and refuses to start another
  run for an id it has seen, so a crash between claim and start leaves the request `claimed` and the page offers
  **Run again**, which is a new request.
- The run's `PIWI_ORIGIN_REF` is `runner:<request id>` (D29), so the run page links the run to its request and the
  page it came from.

### 4. The run

- The runner shows the confirmation: the tests, the folder (`~/work/shop-tests`), the checks (the folder exists, each
  spec is in it, Playwright and its browsers are installed, the branch, with a warning when it differs from the
  branch of the run the request came from), and the exact command. **Run** or **Cancel** (`declined`).
- It runs `playwright test` with the folder's own Playwright and the bundled Node, as `desktop_run_local_tests` does,
  with the reporter pointed at the team instance and streaming on.
- **Saved per project, on the machine**: the folder and the options last used (headed by default). The confirmation
  can change them for one run.

### 5. Progress on the team instance

The run reports to the team instance as it goes, so its run page is already live. The **progress panel** on the page
the person clicked from follows that run through the request: passed, failed, running, the current test, **Stop**
(a request to the runner, on the same channel) and **Run again**. With the live view on in the project, **Watch** shows
the worker's page, as a shared run does today. This is the progress model of [live-runs.md](live-runs.md) P4 and P5,
read from the team instance instead of a local hub; the panel adds no event of its own.

### 6. Raise a ticket, with a comment

At the end of a run, on the panel and on the run page of a local run, when the project has a tracker binding:

- **Type**: the issue types the binding allows (Bug, Improvement, Task, or a team's own such as _Missing test_).
- **Comment**: the person's own words.
- **Attached by Piwi**: the run link, the tests and their results, the branch and commit, the runner's options, and a
  failure's cluster when there is one.

It goes through the integration outbox as a `create-issue` action keyed by `createIssueKey('test_run', runId, …)`
with the person's id added, so a second click files nothing. A row reclaimed after its lease writes the same _create
started_ marker as the test management sync's upload ([zephyr-sync](https://github.com/PiwiTests/piwi/issues/1161)):
a reclaim that finds the marker without an issue key fails with _Outcome unknown_ instead of filing twice. Issue types
and a per-user token come from the tracker work of
[PiwiTests/piwi#1152](https://github.com/PiwiTests/piwi/issues/1152).

### 7. The administrator's setting

`PIWI_LOCAL_RUNNERS` (`off`, `links`, `paired`; default `off`), registered in `shared/piwi-env-vars.ts` with its
`since` release, with a field in `SETTINGS_PAGES` and its help topic:

- **Off**: no **Run on my machine**.
- **Links only**: option 1, for a team that wants no runner table. Requests ride in the link; Stop is a link.
- **Paired runners**: option 2, as above.

Beside it: the maximum tests per request, and whether local runs count in analytics (off by default; they already stay
out of the failure inbox).

## Data model

Two tables, in both schemas (`schema.sqlite.ts`, `schema.pg.ts`) with a migration each, generated as
[`server/database/AGENTS.md`](../apps/application/server/database/AGENTS.md) describes:

- `local_runners`: `id`, `user_id`, `api_key_id`, `device_name`, `platform`, `runner_version`, `created_at`,
  `last_seen_at`, `revoked_at`.
- `runner_requests`: the fields of [Run requests](#3-run-requests), `created_by`, `claimed_at`, `run_id` once the run
  begins.

## Security

- **Only the person's own account** sends requests to their runner. Starting a run on someone else's machine is out
  of scope.
- **The runner asks before every run** unless the person turned on _Run without asking_ for that project, on that
  machine, and that switch shows on **Connected runners**, where it can be turned off.
- **No command, path or environment variable crosses the wire.** The runner refuses a test outside its folder and any
  option outside the list.
- **The key is scoped, kept in the keychain and revocable.** A revoked runner's stream closes and its next request
  answers 401; the runner then asks to pair again.
- **Pairing never happens from a link alone**: the runner names the instance and the account and waits for the person.
- **What leaves the machine**: what the reporter already sends for a run. Nothing of the folder's path.

## Changes to other plans

- **[live-runs.md](live-runs.md)**: the progress panel reads the model of P4 and P5 (lane state, `run-begin` and
  `run-end`, the run's public URL); the start options are P6's **Run headed** and **Hold failures**; a runner is one
  more launcher for P5's `launcher` field. Nothing in those parts changes.
- **[desktop-native.md](desktop-native.md)**: "The team's CI on the developer's desk" asks for a key scoped to
  reading, kept in the keychain, an explicit consent, and links that only open a page or ask in the window first. The
  runner's key and `piwi://pair` follow those rules; under option A, the same pairing gives the desktop app its team
  key.
- **[remote-browsers.md](remote-browsers.md)**: out of scope. A run on a person's machine uses that machine's browsers;
  a suite configured for a grid runs against the grid as it would anywhere.
- **[issue-tracker-integrations.md](issue-tracker-integrations.md)**: **Raise a ticket** is one more `create-issue`
  entity, the run.

## Rollout

Each step is a pull request that leaves the app working and ships its demo (`app/demo/AGENTS.md`): the handlers for
any new endpoint, the seed and the simulator, the tour when a step touches a page it visits, and
`npm run app:seed:demo`. The demo has a canned paired runner whose requests are answered by the simulator, so **Run on
my machine**, the confirmation's outcome and the progress panel work there.

1. **Run requests and the progress panel, desktop app as the runner** (`feat(app)`, `feat(desktop)`). The
   `runner_requests` table, **Run on my machine** with its menu, the request schema in `shared/`, the desktop app
   claiming requests over its existing key, the confirmation, the panel, `PIWI_LOCAL_RUNNERS`.
2. **Pairing and Connected runners** (`feat(auth)`, `feat(desktop)`). `local_runners`, the runner scope on
   `api_keys`, `piwi://pair`, the keychain, the stream and its polling fallback, **Revoke**.
3. **Raise a ticket** (`feat(app)`). The run as a `create-issue` entity, the comment, the type picker, the outbox
   marker.
4. **The runner build** (`feat(desktop)`): B, a separate app, or A, the desktop app's runner mode, as decided.
5. **Later**: _Links only_ (option 1) if a team asks for it; a runner on a shared test machine (a lab PC a team
   requests runs on), which needs its own permission model.

**With the first pull request**: an entry in `ROADMAP.md`, the D64 entry of `1.0-stabilization.md` filled in as the
contracts take shape, and a link to this proposal from `desktop-native.md`.

## Tests

- Unit: the request parser refuses a path outside the folder, a leading `-`, an unknown option and more than the
  maximum tests; a second claim of a request answers 409; an expired request cannot be claimed; a runner that has
  seen a request id starts no second run for it.
- Unit: a `create-issue` row for a run reclaimed after its lease, with the marker and no issue key, never calls the
  tracker again.
- Rust: `piwi://pair` brings the window forward and pairs nothing without a confirmation; every other unknown path
  still returns nothing.
- E2E: **Run on my machine** with a faked runner, from the request to the progress panel's end and **Run again**;
  **Revoke** closes the runner's stream.

## Documentation

A page `features/run-on-my-machine.md`: install and pair the runner, link a folder, run, follow, stop, raise a
ticket; what leaves the machine; the administrator's setting. The desktop page links it.

## Open questions

- A separate runner (B), or a runner mode of the desktop app (A)?
- Should a person's runner accept requests from more than one team instance?
- Should local runs sent to the team instance count in analytics, or stay out by default as proposed?

## Mockups

Static mockups in Piwi's look, marked _proposed, not built_, are on
[#1163](https://github.com/PiwiTests/piwi/issues/1163): **Run on my machine** and its menu, the runner's confirmation,
the progress panel, **Raise a ticket**, the runner's window, pairing and **Connected runners**, and the administrator's
setting.
