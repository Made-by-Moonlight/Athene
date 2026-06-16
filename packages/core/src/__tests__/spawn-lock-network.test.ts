import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createSessionManager } from "../session-manager.js";
import { getProjectDir } from "../paths.js";
import { setupTestContext, teardownTestContext, type TestContext } from "./test-utils.js";

vi.mock("../activity-events.js", () => ({
  recordActivityEvent: vi.fn(),
}));

// Capture the spawn.lock state at the instant `git ls-remote` is invoked.
let lockHeldDuringLsRemote: boolean | null = null;
let lsRemoteCalled = false;

vi.mock("node:child_process", () => {
  const execFileMock = vi.fn() as unknown as {
    (...args: unknown[]): unknown;
    [k: symbol]: unknown;
  };
  // Custom promisify so execFileAsync resolves { stdout, stderr }.
  execFileMock[Symbol.for("nodejs.util.promisify.custom")] = (
    _file: string,
    args: string[],
  ) => {
    if (Array.isArray(args) && args.includes("ls-remote")) {
      lsRemoteCalled = true;
      const lockPath = join(getProjectDir("my-app"), "spawn.lock");
      lockHeldDuringLsRemote = existsSync(lockPath);
    }
    return Promise.resolve({ stdout: "", stderr: "" });
  };
  return { execFile: execFileMock };
});

let ctx: TestContext;

beforeEach(() => {
  ctx = setupTestContext();
  ctx.config.projects["my-app"]!.agent = "mock-agent";
  lockHeldDuringLsRemote = null;
  lsRemoteCalled = false;
});

afterEach(() => {
  vi.useRealTimers();
  teardownTestContext(ctx);
});

describe("spawn lock does not span the remote lookup", () => {
  it("performs git ls-remote BEFORE acquiring the per-project spawn lock", async () => {
    vi.useFakeTimers();
    const sm = createSessionManager({ config: ctx.config, registry: ctx.mockRegistry });
    const spawnPromise = sm.spawn({ projectId: "my-app", prompt: "x" });
    await vi.runAllTimersAsync();
    await spawnPromise;

    expect(lsRemoteCalled).toBe(true);
    // The network round-trip ran while the spawn lock was NOT held.
    expect(lockHeldDuringLsRemote).toBe(false);
  });
});
