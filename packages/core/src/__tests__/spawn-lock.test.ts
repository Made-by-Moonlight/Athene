import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isSpawnLockReapable } from "../session-manager.js";

const dirs: string[] = [];
function lockWith(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ao-spawnlock-"));
  dirs.push(dir);
  const lockPath = join(dir, "spawn.lock");
  writeFileSync(lockPath, content);
  return lockPath;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("isSpawnLockReapable", () => {
  it("does NOT reap a FRESH lock held by a live PID", () => {
    const lockPath = lockWith(String(process.pid));
    expect(isSpawnLockReapable(lockPath, Date.now())).toBe(false);
  });

  it("reaps a PID-bearing lock past the absolute age ceiling even if the PID is alive (PID reuse)", () => {
    // process.pid is alive, but the lock is older than the ceiling — a recycled
    // dead-holder PID must not block spawns forever.
    const lockPath = lockWith(String(process.pid));
    expect(isSpawnLockReapable(lockPath, Date.now() + 6 * 60_000)).toBe(true);
  });

  it("reaps a lock whose recorded PID is dead", () => {
    const lockPath = lockWith("2147483646"); // far beyond any live PID → dead
    expect(isSpawnLockReapable(lockPath)).toBe(true);
  });

  it("does NOT reap a corrupt/no-PID lock while it is fresh", () => {
    const lockPath = lockWith(""); // mid-write / legacy — no parseable PID
    expect(isSpawnLockReapable(lockPath, Date.now())).toBe(false);
  });

  it("reaps a corrupt/no-PID lock only after the absolute age ceiling", () => {
    const lockPath = lockWith("not-a-pid");
    // Fresh: not reapable; past the 5-minute ceiling: reapable.
    expect(isSpawnLockReapable(lockPath, Date.now())).toBe(false);
    expect(isSpawnLockReapable(lockPath, Date.now() + 6 * 60_000)).toBe(true);
  });

  it("treats a missing lock as reapable (vanished between checks)", () => {
    expect(isSpawnLockReapable(join(tmpdir(), "ao-no-such-lock-xyz", "spawn.lock"))).toBe(true);
  });
});
