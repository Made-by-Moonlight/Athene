# @made-by-moonlight/athene-plugin-terminal-iterm2

## 0.13.0

### Minor Changes

- - Merge pull request #73 from slievr/feat/direct-main-release
  - Merge pull request #72 from slievr/feat/ci-paths-filter
  - ci: return green without heavy work on docs-only changes
  - Merge pull request #71 from slievr/chore/remove-deploy-vps
  - ci: push version bump directly to main, drop version-bump PR mechanism
  - ci: skip jobs on docs-only changes via dorny/paths-filter
  - chore: remove deploy-vps workflow
  - Merge pull request #68 from slievr/release/0.12.0
  - Merge pull request #70 from slievr/feat/automate-canary-publish
  - Merge pull request #64 from slievr/fix/rename-ao-to-athene-in-cli-output
  - ci: route canary npm publishing through release.yml (already OIDC-registered)
  - chore: resolve merge conflict with main in spawn.ts
  - test: update CLI test assertions to expect 'Athene' instead of 'AO'
  - ci: publish canary packages to npm via OIDC trusted publishing
  - Merge pull request #63 from slievr/docs/go-engine-migration-plan
  - Merge pull request #69 from slievr/feat/version-in-sidebar
  - fix: stamp version from package.json into NEXT_PUBLIC_APP_VERSION at build time
  - Merge pull request #67 from slievr/chore/release-changeset
  - chore: add changeset for orchestrator management, spawn fix, version display
  - Merge pull request #66 from slievr/feat/version-in-sidebar
  - fix: defer version fetch until settings popover opens to avoid test interference
  - feat: show installed version in sidebar settings popover
  - Merge pull request #65 from slievr/fix/spawn-without-lifecycle-worker
  - test: update spawn daemon enforcement tests for collapsed orchestrator model
  - fix: allow spawning into projects not yet tracked by lifecycle supervisor
  - fix: replace "AO" with "Athene" in user-facing CLI output
  - docs: add phased Go engine migration plan
  - Merge pull request #62 from slievr/feat/orchestrator-management
  - fix: replace dynamic delete with immutable spread in deleteOrchestrator
  - fix: typecheck in session-manager, startup guard, create modal scope paths
  - fix: OrchestratorSettingsBar error handling, tests, scope popover close
  - feat: inline session label editor on kanban card
  - feat: OrchestratorSettingsBar — inline rename, scope picker, discovery toggle, delete
  - test: mock ensureOrchestratorUUIDs in services.test.ts
  - feat: PATCH/DELETE /api/orchestrators/[id] for update and remove
  - fix: pass orchestrator display label as projectName to Dashboard, not UUID
  - feat: UUID-based orchestrator routing, sidebar links use o.id
  - fix: update api/orchestrators route scope type to string[]
  - feat: startup UUID migration, add id/label to SidebarOrchestrator, path to ProjectInfo
  - feat: stamp orchestratorId UUID at session spawn, add to DashboardSession
  - feat: add ensureOrchestratorUUIDs, updateOrchestrator, deleteOrchestrator to config writer
  - feat: update orchestrator scope to directory paths, add id/name fields
  - docs: implementation plan for orchestrator management (9 tasks)
  - docs: spec for orchestrator management (UUID identity, labels, scope, discovery, delete)
  - Merge pull request #60 from slievr/fix/printf-changeset
  - fix(release): check for open PRs only when deciding whether to create version bump PR
  - feat(ci): add version-bump-ci to satisfy checks on release/\* branches
  - feat(ci): add version-bump-ci workflow to auto-satisfy checks on release/\* branches
  - Merge pull request #57 from slievr/fix/printf-changeset
  - test: verify release/\* PR direct merge in workflow (no --auto, no --admin)

### Patch Changes

- Updated dependencies
  - @made-by-moonlight/athene-core@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [80ef5dc]
  - @made-by-moonlight/athene-core@0.12.0

## 0.11.3

### Patch Changes

- 9b038ff: test: verify release/\* PR merges without CI in workflow
- Updated dependencies [9b038ff]
  - @made-by-moonlight/athene-core@0.11.3

## 0.11.2

### Patch Changes

- 22aef23: test: verify release auto-merge works for release/\* branches
- Updated dependencies [22aef23]
  - @made-by-moonlight/athene-core@0.11.2

## 0.11.1

### Patch Changes

- ed7c6c7: fix: republish athene with correct athene-cli dependency (0.11.0 had workspace:\* dep bug)
- Updated dependencies [ed7c6c7]
  - @made-by-moonlight/athene-core@0.11.1

## 0.11.0

### Minor Changes

- - Merge pull request #41 from slievr/feat/fleet-kanban
  - fix(release): gate publish on did_bump flag not npm check for single package
  - fix(release): gate publish on did_bump flag not npm check for single package
  - fix(release): allow workflow_dispatch to pass job-level if condition
  - fix(release): allow workflow_dispatch to pass the job-level if condition
  - fix(release): list all linked packages in auto-generated changeset to ensure all are bumped
  - fix(release): list all linked packages in auto-generated changeset to ensure all are bumped
  - fix(core): merge duplicate type import in session-parent test
  - fix(release): exclude .github/ from version bump commit to avoid workflows permission error
  - fix(release): exclude .github/ from version bump commit to avoid workflows permission error
  - feat(release): add workflow_dispatch trigger for manual release runs
  - feat(release): add workflow_dispatch trigger for manual release runs
  - fix(release): force-push release branch and skip PR creation if already exists
  - fix(release): force-push release branch and skip PR creation if already exists
  - fix(publish): extract .tgz filename from pnpm pack multi-line output
  - fix(publish): extract .tgz filename from pnpm pack output instead of using full output
  - fix(release): use auto-merge PR for version bump to satisfy branch protection
  - fix(release): use auto-merge PR for version bump to satisfy branch protection
  - fix(web): sync fleet filter with URL params, add chip dots/timestamps, add project session badge
  - feat(web): convert project page to settings view, remove kanban
  - feat(web): add Fleet nav entry to sidebar
  - feat(web): add /fleet route
  - fix(release): use echo instead of printf to avoid bash treating --- as flags
  - feat(web): add FleetBoard component with orchestrator grouping
  - feat(web): add FleetColumn component
  - feat(web): add OrchestratorGroup component
  - feat(web): add FleetFilterBar component
  - feat(web): add accentClass prop to SessionCard for orchestrator border color
  - feat(web): add orchestrator color palette and CSS accent classes
  - feat(release): auto-generate changeset from conventional commits on every merge
  - fix(release): check npm registry instead of git history to detect unpublished versions
  - docs: add fleet kanban implementation plan
  - docs: add fleet kanban design spec
  - feat(core): add getSessionParentId helper and stamp parentSessionId at spawn
  - docs: add fleet kanban implementation plan
  - test(web): fix flaky DirectoryBrowser keyboard-navigation test
  - fix(web): fix spawn form cancel and hide project select for single project
  - docs: add fleet kanban design spec
  - fix(release): restore pnpm pack and auto-publish without version PR
  - fix(web): orchestrator dropdown shows own session + sub-orchestrators only
  - chore: version packages
  - fix(agent-claude-code): correct ao spawn → athene spawn in subagent blocker
  - feat(web): expandable orchestrator session list and inline spawn in sidebar
  - feat(web): add orchestrator session spawning and fix fleet filter
  - fix(publish): use pnpm pack to resolve workspace:\* before npm publish
  - test(web): update SidebarOrchestrators test for session-path collapsed glyph
  - fix(web): orchestrator session routing and sidebar visibility
  - ci: remove dependency-review job (requires GitHub Advanced Security)
  - fix(web,core): orchestrator creation and terminal navigation
  - fix: update CLI tests for removed per-project orchestrator spawn and remove unused imports

### Patch Changes

- Updated dependencies
  - @made-by-moonlight/athene-core@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [dc706d5]
  - @made-by-moonlight/athene-core@0.10.0

## 0.9.1

### Patch Changes

- 2d4c457: Fix canary nightly to include all publishable packages and fix Next.js import.meta.url build path issue
- Updated dependencies [2d4c457]
  - @made-by-moonlight/athene-core@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [73bed33]
- Updated dependencies [a610601]
- Updated dependencies [7d9b862]
- Updated dependencies [6d48022]
- Updated dependencies [fcedb25]
- Updated dependencies [94981dc]
- Updated dependencies [2980570]
- Updated dependencies [d5d0f07]
  - @made-by-moonlight/athene-core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies
  - @made-by-moonlight/athene-core@0.8.0

## 0.7.0

### Minor Changes

- 0f5ae0b: feat: native Windows support

  AO now runs natively on Windows. The default runtime on Windows is `process`
  (ConPTY via `node-pty` + named pipes — no tmux, no WSL); the dashboard,
  agents (claude-code, codex, kimicode, aider, opencode, cursor), `athene doctor`,
  and `athene update` all work out of the box. Each session gets a small detached
  pty-host helper that wraps a ConPTY behind `\\.\pipe\ao-pty-<sessionId>`,
  registered so `athene stop` can reach it.

  A new cross-platform abstraction layer (`packages/core/src/platform.ts`)
  centralises every platform branch behind helpers like `isWindows()`,
  `getDefaultRuntime()`, `getShell()`, `killProcessTree()`, `findPidByPort()`,
  and `getEnvDefaults()`. Path comparison uses `pathsEqual` /
  `canonicalCompareKey` to handle NTFS case-insensitivity. PATH wrappers for
  agent plugins (`gh`, `git`) ship as `.cjs` + `.cmd` shims on Windows;
  `script-runner` runs `.ps1` siblings of `.sh` scripts via PowerShell. New
  `athene-doctor.ps1` / `athene-update.ps1` shipped.

  `athene open` is now cross-platform: it sources sessions from `sm.list()`
  instead of `tmux list-sessions` (so `runtime-process` sessions on Windows
  appear), and the open action branches per OS — `open-iterm-tab` stays the
  macOS path, native handling on Windows and Linux.

  Behaviour on macOS and Linux is unchanged. Every Windows path is gated
  behind `isWindows()`; `runtime-tmux` and the bash hook flows are untouched.

  See `docs/CROSS_PLATFORM.md` for the developer reference (helper inventory,
  EPERM-vs-ESRCH gotcha, PowerShell-vs-bash differences, pre-merge checklist).
  The Windows runtime architecture (pty-host, pipe protocol, registry, sweep,
  mux WS Windows branch) is documented in `docs/ARCHITECTURE.md`.

### Patch Changes

- Updated dependencies [0f5ae0b]
- Updated dependencies [fe33bb7]
- Updated dependencies [7c46dc9]
  - @made-by-moonlight/athene-core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies
- Updated dependencies [40aeb78]
- Updated dependencies
- Updated dependencies
  - @made-by-moonlight/athene-core@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [dd07b6b]
  - @made-by-moonlight/athene-core@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [2306078]
- Updated dependencies [faaddb1]
- Updated dependencies [f330a1e]
- Updated dependencies [a862327]
- Updated dependencies [331f1ce]
- Updated dependencies [703d584]
- Updated dependencies [f674422]
- Updated dependencies [62353eb]
- Updated dependencies [bd36c7b]
- Updated dependencies [e7ad928]
- Updated dependencies [ca8c4cc]
- Updated dependencies [7b82374]
- Updated dependencies [4701122]
- Updated dependencies [c8af50f]
- Updated dependencies [bcdda4b]
- Updated dependencies [1cbf657]
- Updated dependencies [c447c7c]
- Updated dependencies [a45eb32]
- Updated dependencies [7072143]
- Updated dependencies [ed2dcea]
  - @made-by-moonlight/athene-core@0.4.0

## 0.2.0

### Patch Changes

- Updated dependencies [3a650b0]
  - @composio/ao-core@0.2.0
