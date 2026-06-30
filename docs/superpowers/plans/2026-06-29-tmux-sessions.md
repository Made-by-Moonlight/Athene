# Athene tmux-Backed Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stub session spawning with real tmux sessions so agents survive app restarts, with live PTY I/O wired into the terminal Canvas widget.

**Architecture:** A new `tmux` module in `athene-core` wraps tmux CLI commands. A new `pty` module creates FIFOs for streaming pane output and opens pane TTYs for input. `App::new()` rehydrates from the DB on startup and reconnects live tmux sessions. The REST `DELETE /sessions/:id` and native `TerminateSession` message both delegate to `Engine::terminate_session` which kills the tmux session and updates the DB.

**Tech Stack:** tmux (system dependency, already required by the existing TypeScript stack), `tokio::io::unix::AsyncFd` for non-blocking FIFO reads, `libc` O_NONBLOCK / O_NOCTTY (already in workspace deps), `tokio::process::Command` (in tokio::full, already in workspace deps).

## Global Constraints

- macOS + Linux only. No Windows.
- Tmux session name == `Session.id` (validated format: `[a-zA-Z0-9_-]+`)
- FIFO path: `/tmp/athene-{session_id}.fifo`
- Default agent command: `claude`
- No new workspace-level dependencies — `libc` and `tokio` (with `full` features) are already declared.
- `update()` is a pure function: `(Model, Message) → (Model, Task<Message>)`. Async side-effects live in `Task::future(...)` blocks.
- Panic-free: all tmux errors are logged with `tracing::error!`, never panic.

---

## File Structure

**Create:**
- `athene/crates/athene-core/src/tmux.rs` — async wrappers for all tmux CLI operations
- `athene/crates/athene-core/src/pty.rs` — FIFO creation, pipe-pane setup, PTY streaming task

**Modify:**
- `athene/crates/athene-core/src/lib.rs` — add `pub mod tmux; pub mod pty;`
- `athene/crates/athene-core/src/store.rs` — add `Store::get_session`
- `athene/crates/athene-core/src/events.rs` — add `Engine::terminate_session`
- `athene/crates/athene-app/src/app.rs` — restore state on startup, real spawn, `Message::Noop`, `Message::TerminateSession`
- `athene/crates/athene-app/src/components/spawn_modal.rs` — add `workspace` field
- `athene/crates/athene-server/src/routes/sessions.rs` — real `terminate_session` handler

---

## Task 1: tmux module

**Files:**
- Create: `athene/crates/athene-core/src/tmux.rs`
- Modify: `athene/crates/athene-core/src/lib.rs`

**Interfaces:**
- Produces: `TmuxSession { id, created_ms, pid, tty }`, `create_session(id, workspace, cmd, env) -> Result<()>`, `kill_session(id) -> Result<()>`, `has_session(id) -> bool`, `list_sessions() -> Result<Vec<TmuxSession>>`, `get_pane_tty(id) -> Result<Option<String>>`, `pipe_pane(id, dest_path) -> Result<()>`

---

- [ ] **Step 1: Write tests**

```rust
// athene/crates/athene-core/src/tmux.rs  (test module — add at the bottom)
#[cfg(test)]
mod tests {
    use super::*;

    fn tmux_available() -> bool {
        std::process::Command::new("tmux")
            .args(["-V"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn unique_id() -> String {
        format!(
            "test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    }

    #[tokio::test]
    async fn create_and_has_and_kill() {
        if !tmux_available() { return; }
        let id = unique_id();
        create_session(&id, "/tmp", "sleep 30", &[]).await.unwrap();
        assert!(has_session(&id).await);
        kill_session(&id).await.unwrap();
        assert!(!has_session(&id).await);
    }

    #[tokio::test]
    async fn list_includes_created() {
        if !tmux_available() { return; }
        let id = unique_id();
        create_session(&id, "/tmp", "sleep 30", &[]).await.unwrap();
        let sessions = list_sessions().await.unwrap();
        assert!(sessions.iter().any(|s| s.id == id));
        kill_session(&id).await.unwrap();
    }

    #[tokio::test]
    async fn get_pane_tty_returns_dev_path() {
        if !tmux_available() { return; }
        let id = unique_id();
        create_session(&id, "/tmp", "sleep 30", &[]).await.unwrap();
        let tty = get_pane_tty(&id).await.unwrap();
        assert!(tty.map(|t| t.starts_with("/dev/")).unwrap_or(false));
        kill_session(&id).await.unwrap();
    }
}
```

- [ ] **Step 2: Run to verify compile error**

```bash
cd athene && cargo test -p athene-core tmux 2>&1 | tail -5
```

Expected: compile error — `tmux` module not found.

- [ ] **Step 3: Implement `athene/crates/athene-core/src/tmux.rs`**

```rust
use anyhow::{Context, Result};
use tokio::process::Command;

/// Metadata about a running tmux session from `list-sessions`.
#[derive(Debug, Clone)]
pub struct TmuxSession {
    pub id:         String,
    pub created_ms: i64,
    pub pid:        Option<u32>,
    pub tty:        Option<String>,
}

/// Run a tmux subcommand and return trimmed stdout.
async fn run(args: &[&str]) -> Result<String> {
    let out = Command::new("tmux")
        .args(args)
        .kill_on_drop(true)
        .output()
        .await
        .context("tmux not found — install tmux (brew install tmux / apt install tmux)")?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("tmux {:?} failed: {}", args, stderr.trim());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim_end().to_string())
}

/// Run tmux; swallow errors and return empty string on failure.
async fn run_best_effort(args: &[&str]) -> String {
    run(args).await.unwrap_or_default()
}

/// Create a detached tmux session.  Kills a stale session with the same name
/// if one exists, then hides the status bar so the terminal widget is clean.
pub async fn create_session(
    id:        &str,
    workspace: &str,
    cmd:       &str,
    env:       &[(&str, &str)],
) -> Result<()> {
    // Build -e KEY=VALUE pairs
    let env_pairs: Vec<String> = env.iter().map(|(k, v)| format!("{k}={v}")).collect();
    let mut extra: Vec<&str> = Vec::new();
    for pair in &env_pairs {
        extra.push("-e");
        extra.push(pair.as_str());
    }

    let mut base = vec!["new-session", "-d", "-s", id, "-c", workspace];
    base.extend_from_slice(&extra);
    base.push(cmd);

    for attempt in 0..2u8 {
        match run(&base).await {
            Ok(_) => break,
            Err(e) if attempt == 0 && e.to_string().contains("duplicate session") => {
                run_best_effort(&["kill-session", "-t", id]).await;
            }
            Err(e) => return Err(e),
        }
    }

    // Best-effort: hide the tmux status bar so the terminal widget isn't cluttered.
    let _ = run(&["set-option", "-t", id, "status", "off"]).await;
    Ok(())
}

/// Kill a tmux session.  Succeeds even if the session doesn't exist.
pub async fn kill_session(id: &str) -> Result<()> {
    match run(&["kill-session", "-t", id]).await {
        Ok(_) => Ok(()),
        Err(e)
            if e.to_string().contains("no server running")
                || e.to_string().contains("can't find session") =>
        {
            Ok(())
        }
        Err(e) => Err(e),
    }
}

/// Returns `true` if a tmux session with this name is currently running.
pub async fn has_session(id: &str) -> bool {
    run(&["has-session", "-t", id]).await.is_ok()
}

/// List every live tmux session.
pub async fn list_sessions() -> Result<Vec<TmuxSession>> {
    let raw = run_best_effort(&[
        "list-sessions",
        "-F",
        "#{session_name}\t#{session_created}\t#{pane_pid}\t#{pane_tty}",
    ])
    .await;
    Ok(raw
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let mut cols = line.splitn(4, '\t');
            let id  = cols.next()?.to_string();
            let sec = cols.next().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            let pid = cols.next().and_then(|s| s.parse::<u32>().ok());
            let tty = cols.next().map(str::to_string).filter(|s| !s.is_empty());
            Some(TmuxSession { id, created_ms: sec * 1000, pid, tty })
        })
        .collect())
}

/// Return the tty device path (e.g. `/dev/ttys003`) for the session's active pane.
pub async fn get_pane_tty(id: &str) -> Result<Option<String>> {
    let out = run(&["list-panes", "-t", id, "-F", "#{pane_tty}"]).await?;
    Ok(out
        .lines()
        .next()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty()))
}

/// Start piping pane output to `dest_path` (regular file, not FIFO).
/// The flag `-o` means "only start a new pipe if none is running".
pub async fn pipe_pane(id: &str, dest_path: &str) -> Result<()> {
    run(&["pipe-pane", "-o", "-t", id, &format!("cat > {dest_path}")]).await?;
    Ok(())
}
```

- [ ] **Step 4: Add `pub mod tmux; pub mod pty;` to `lib.rs`**

In `athene/crates/athene-core/src/lib.rs`, add after the existing `pub mod` lines:

```rust
pub mod pty;
pub mod tmux;
```

(Place `pty` before `store` alphabetically so the file stays sorted.)

- [ ] **Step 5: Run tests**

```bash
cd athene && cargo test -p athene-core tmux
```

Expected: 3 tests pass (or pass silently if tmux not installed).

- [ ] **Step 6: Commit**

```bash
git add athene/crates/athene-core/src/tmux.rs athene/crates/athene-core/src/lib.rs
git commit -m "feat(engine): tmux session management module"
```

---

## Task 2: PTY streaming

**Files:**
- Create: `athene/crates/athene-core/src/pty.rs`

**Interfaces:**
- Consumes: `tmux::pipe_pane`, `tmux::get_pane_tty`, `Engine::emit`, `Engine::register_pty_writer`
- Produces: `start_streaming(engine: Arc<Engine>, session_id: SessionId, tmux_id: &str) -> Result<()>`

**How it works:** Creates a named FIFO, opens it non-blocking (so `open()` returns immediately without a writer), then tells tmux to pipe pane output into it via `cat > fifo`. An `AsyncFd` task reads the FIFO and emits `Event::TerminalOutput`. Separately, opens the pane's TTY device for writing and spawns a task that forwards bytes from the engine's PTY writer channel to the TTY.

---

- [ ] **Step 1: Write integration test**

```rust
// athene/crates/athene-core/src/pty.rs  (test module — add at the bottom)
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{events::Engine, store::Store, tmux};
    use std::sync::Arc;
    use tempfile::tempdir;
    use tokio::time::{sleep, Duration};

    fn tmux_available() -> bool {
        std::process::Command::new("tmux")
            .args(["-V"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn unique_id() -> String {
        format!(
            "pt-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    }

    fn test_engine() -> Arc<Engine> {
        let store =
            Arc::new(Store::open(tempdir().unwrap().keep().join("t.db")).unwrap());
        Engine::new(store)
    }

    #[tokio::test]
    async fn streaming_round_trip() {
        if !tmux_available() { return; }

        let id     = unique_id();
        let engine = test_engine();
        let mut rx = engine.subscribe();

        tmux::create_session(&id, "/tmp", "bash", &[]).await.unwrap();
        // Give bash a moment to start before piping.
        sleep(Duration::from_millis(300)).await;
        start_streaming(engine.clone(), id.clone(), &id).await.unwrap();

        // Send a command through the PTY writer.
        sleep(Duration::from_millis(200)).await;
        if let Some(w) = engine.get_pty_writer(&id).await {
            let _ = w.send(b"echo athene-test\n".to_vec());
        }

        // Wait up to 3 s for TerminalOutput containing "athene-test".
        let found = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                if let Ok(crate::events::Event::TerminalOutput { session_id, bytes }) =
                    rx.recv().await
                {
                    if session_id == id
                        && bytes.windows(11).any(|w| w == b"athene-test")
                    {
                        return true;
                    }
                }
            }
        })
        .await
        .unwrap_or(false);

        tmux::kill_session(&id).await.unwrap();
        assert!(found, "never received 'athene-test' in TerminalOutput");
    }
}
```

- [ ] **Step 2: Run to verify compile error**

```bash
cd athene && cargo test -p athene-core pty 2>&1 | tail -5
```

Expected: compile error — `pty` module not found.

- [ ] **Step 3: Implement `athene/crates/athene-core/src/pty.rs`**

```rust
use crate::{
    events::{Engine, Event},
    tmux,
    types::SessionId,
};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;

fn fifo_path(session_id: &str) -> String {
    format!("/tmp/athene-{session_id}.fifo")
}

/// Wire up PTY streaming for an already-running tmux session:
///
/// 1. Creates a FIFO at `/tmp/athene-{session_id}.fifo`.
/// 2. Opens the FIFO non-blocking for reading so `open()` returns immediately.
/// 3. Tells tmux to pipe pane output to the FIFO via `cat`.
/// 4. Spawns a task that reads the FIFO with `AsyncFd` and emits `Event::TerminalOutput`.
/// 5. Opens the pane's TTY device for writing.
/// 6. Spawns a task that forwards bytes from the mpsc input channel to the TTY.
/// 7. Registers the input sender with the engine so the WebSocket terminal can use it.
pub async fn start_streaming(
    engine:     Arc<Engine>,
    session_id: SessionId,
    tmux_id:    &str,
) -> Result<()> {
    let path = fifo_path(&session_id);

    // Remove stale FIFO from a previous session with this ID.
    let _ = std::fs::remove_file(&path);

    // Create the FIFO.
    let status = tokio::process::Command::new("mkfifo")
        .arg(&path)
        .status()
        .await?;
    anyhow::ensure!(status.success(), "mkfifo {path} failed");

    // Open the FIFO for non-blocking read.  O_NONBLOCK means `open()` returns
    // immediately even though tmux hasn't opened the write end yet.
    let fifo_file = {
        use std::os::unix::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NONBLOCK)
            .open(&path)?
    };

    // Tell tmux to stream pane output into the FIFO.
    tmux::pipe_pane(tmux_id, &path).await?;

    // --- Output task: FIFO → Event::TerminalOutput ---
    let engine_out = engine.clone();
    let sid_out    = session_id.clone();
    let path_out   = path.clone();
    tokio::spawn(async move {
        use tokio::io::{unix::AsyncFd, Interest};

        let async_fd =
            match AsyncFd::with_interest(fifo_file, Interest::READABLE) {
                Ok(fd) => fd,
                Err(e) => {
                    tracing::error!("AsyncFd setup for {sid_out}: {e}");
                    return;
                }
            };

        let mut buf = vec![0u8; 4096];
        loop {
            let mut guard = match async_fd.readable().await {
                Ok(g) => g,
                Err(_) => break,
            };
            let result = guard.try_io(|inner| {
                use std::io::Read;
                inner.get_ref().read(&mut buf)
            });
            match result {
                Ok(Ok(0)) => break, // EOF: tmux session died / pipe-pane stopped
                Ok(Ok(n)) => {
                    engine_out.emit(Event::TerminalOutput {
                        session_id: sid_out.clone(),
                        bytes:      buf[..n].to_vec(),
                    });
                }
                Ok(Err(e)) => {
                    tracing::error!("FIFO read {sid_out}: {e}");
                    break;
                }
                Err(_would_block) => {} // guard cleared; wait for next readable()
            }
        }
        let _ = std::fs::remove_file(&path_out);
        tracing::info!("PTY stream ended for {sid_out}");
    });

    // --- Input task: mpsc channel → TTY write ---
    let tty_path = tmux::get_pane_tty(tmux_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("no TTY found for tmux session {tmux_id}"))?;

    let (input_tx, mut input_rx) = mpsc::unbounded_channel::<Vec<u8>>();
    engine.register_pty_writer(session_id.clone(), input_tx).await;

    tokio::spawn(async move {
        while let Some(bytes) = input_rx.recv().await {
            let tty = tty_path.clone();
            // Open fresh each write: TTY file is tiny, handles are cheap,
            // and keeping one open risks SIGPIPE if the pane restarts.
            tokio::task::spawn_blocking(move || {
                use std::io::Write;
                use std::os::unix::fs::OpenOptionsExt;
                if let Ok(mut f) = std::fs::OpenOptions::new()
                    .write(true)
                    .custom_flags(libc::O_NOCTTY)
                    .open(&tty)
                {
                    let _ = f.write_all(&bytes);
                }
            })
            .await
            .ok();
        }
    });

    Ok(())
}
```

- [ ] **Step 4: Run tests**

```bash
cd athene && cargo test -p athene-core pty
```

Expected: 1 test passes (or silently skips if tmux not installed).

- [ ] **Step 5: Commit**

```bash
git add athene/crates/athene-core/src/pty.rs
git commit -m "feat(engine): PTY streaming via FIFO and pane TTY"
```

---

## Task 3: Store::get_session + Engine::terminate_session

**Files:**
- Modify: `athene/crates/athene-core/src/store.rs`
- Modify: `athene/crates/athene-core/src/events.rs`

**Interfaces:**
- Produces: `Store::get_session(id: &str) -> Result<Option<Session>>`, `Engine::terminate_session(session_id: &str) -> Result<()>`

---

- [ ] **Step 1: Write store test**

```rust
// athene/crates/athene-core/src/store.rs  (add to existing tests mod)
#[test]
fn get_session_by_id() {
    let store = test_store();
    let s = Session {
        id: "s1".into(), orchestrator_id: None, name: "w".into(),
        repo: "r".into(), status: SessionStatus::Working,
        agent_type: "c".into(), cost_usd: 0.0, started_at: 0,
        pr_number: None, pr_id: None, workspace_path: None, pid: None,
    };
    store.upsert_session(&s).unwrap();
    let found = store.get_session("s1").unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "w");
    assert!(store.get_session("missing").unwrap().is_none());
}
```

- [ ] **Step 2: Run to verify failure**

```bash
cd athene && cargo test -p athene-core store::tests::get_session_by_id 2>&1 | tail -5
```

Expected: compile error — `get_session` not defined.

- [ ] **Step 3: Add `Store::get_session` to `store.rs`**

Add this method to `impl Store`, after `list_sessions`:

```rust
pub fn get_session(&self, id: &str) -> Result<Option<Session>> {
    let mut stmt = self.conn.prepare(
        "SELECT id,orchestrator_id,name,repo,status,agent_type,cost_usd,
         started_at,pr_number,pr_id,workspace_path,pid
         FROM sessions WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map([id], |r| {
        Ok((
            r.get::<_, String>(0)?,  r.get(1)?,  r.get(2)?,  r.get(3)?,
            r.get::<_, String>(4)?,  r.get(5)?,  r.get(6)?,  r.get(7)?,
            r.get(8)?,  r.get(9)?,  r.get(10)?, r.get(11)?,
        ))
    })?;
    match rows.next() {
        None => Ok(None),
        Some(r) => {
            let (id, orchestrator_id, name, repo, status_str, agent_type,
                 cost_usd, started_at, pr_number, pr_id, workspace_path, pid) = r?;
            let status = serde_json::from_str(&format!("\"{status_str}\""))
                .unwrap_or(SessionStatus::Working);
            Ok(Some(Session {
                id, orchestrator_id, name, repo, status, agent_type,
                cost_usd, started_at, pr_number, pr_id, workspace_path, pid,
            }))
        }
    }
}
```

- [ ] **Step 4: Run store tests**

```bash
cd athene && cargo test -p athene-core store
```

Expected: all 3 store tests pass.

- [ ] **Step 5: Write engine terminate test**

```rust
// athene/crates/athene-core/src/events.rs  (add to existing tests mod)
#[tokio::test]
async fn terminate_emits_session_updated() {
    let store = Arc::new(Store::open(tempdir().unwrap().keep().join("t.db")).unwrap());
    let session = crate::types::Session {
        id: "s1".into(), orchestrator_id: None, name: "w".into(),
        repo: "r".into(), status: crate::types::SessionStatus::Working,
        agent_type: "c".into(), cost_usd: 0.0, started_at: 0,
        pr_number: None, pr_id: None, workspace_path: None, pid: None,
    };
    store.upsert_session(&session).unwrap();
    let engine = Engine::new(store);
    let mut rx = engine.subscribe();

    engine.terminate_session("s1").await.unwrap();

    let evt = rx.recv().await.unwrap();
    if let Event::SessionUpdated(s) = evt {
        assert!(matches!(s.status, crate::types::SessionStatus::Terminated));
    } else {
        panic!("expected SessionUpdated");
    }
}
```

- [ ] **Step 6: Run to verify failure**

```bash
cd athene && cargo test -p athene-core events::tests::terminate_emits_session_updated 2>&1 | tail -5
```

Expected: compile error — `terminate_session` not defined.

- [ ] **Step 7: Add `Engine::terminate_session` to `events.rs`**

Add this method to `impl Engine`:

```rust
/// Kill the tmux session, mark it Terminated in the DB, and emit SessionUpdated.
pub async fn terminate_session(&self, session_id: &str) -> anyhow::Result<()> {
    // Best-effort tmux kill (session may already be dead).
    let _ = crate::tmux::kill_session(session_id).await;

    if let Some(mut session) = self.store.get_session(session_id)? {
        session.status = crate::types::SessionStatus::Terminated;
        self.store.upsert_session(&session)?;
        self.emit(Event::SessionUpdated(session));
    }
    Ok(())
}
```

- [ ] **Step 8: Run tests**

```bash
cd athene && cargo test -p athene-core
```

Expected: all 7 tests pass.

- [ ] **Step 9: Commit**

```bash
git add athene/crates/athene-core/src/store.rs \
        athene/crates/athene-core/src/events.rs
git commit -m "feat(engine): Store::get_session and Engine::terminate_session"
```

---

## Task 4: Spawn form — add workspace field

**Files:**
- Modify: `athene/crates/athene-app/src/components/spawn_modal.rs`
- Modify: `athene/crates/athene-app/src/app.rs`

**Interfaces:**
- Consumes: `SpawnForm { name, workspace }` (both fields required to enable Submit)
- Produces: `Message::SpawnFormWorkspace(String)` handled in `apply`

---

- [ ] **Step 1: Add `workspace` to `SpawnForm` and update the modal UI**

Replace the entire contents of `athene/crates/athene-app/src/components/spawn_modal.rs`:

```rust
use iced::{
    widget::{button, column, container, row, text, text_input, Space},
    Alignment, Background, Border, Color, Element, Length,
};

use crate::{
    app::Message,
    theme::{ACCENT_AMBER, BG_ELEVATED, BG_SURFACE, BORDER, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY},
};

#[derive(Debug, Clone, Default)]
pub struct SpawnForm {
    pub name:      String,
    pub workspace: String,
}

pub fn spawn_modal(form: &SpawnForm) -> Element<'_, Message> {
    let can_submit =
        !form.name.trim().is_empty() && !form.workspace.trim().is_empty();

    let dialog = container(
        column![
            text("Spawn Orchestrator").size(16).color(TEXT_PRIMARY),
            Space::new(0, 4),
            column![
                text("Name").size(11).color(TEXT_MUTED),
                Space::new(0, 4),
                text_input("e.g. my-feature", &form.name)
                    .on_input(Message::SpawnFormName)
                    .on_submit_maybe(can_submit.then_some(Message::SpawnFormConfirm))
                    .padding(8)
                    .size(13),
            ]
            .spacing(0),
            column![
                text("Workspace").size(11).color(TEXT_MUTED),
                Space::new(0, 4),
                text_input("~/projects/my-repo", &form.workspace)
                    .on_input(Message::SpawnFormWorkspace)
                    .on_submit_maybe(can_submit.then_some(Message::SpawnFormConfirm))
                    .padding(8)
                    .size(13),
            ]
            .spacing(0),
            Space::new(0, 4),
            row![
                button(text("Cancel").size(12).color(TEXT_SECONDARY))
                    .on_press(Message::SpawnFormCancel)
                    .style(|_theme, _status| button::Style {
                        background: None,
                        text_color: TEXT_SECONDARY,
                        border: Border { color: BORDER, width: 1.0, radius: 4.0.into() },
                        ..Default::default()
                    })
                    .padding([5, 12]),
                Space::new(Length::Fill, 0),
                button(
                    text("Spawn")
                        .size(12)
                        .color(if can_submit { Color::WHITE } else { TEXT_MUTED }),
                )
                .on_press_maybe(can_submit.then_some(Message::SpawnFormConfirm))
                .style(move |_theme, _status| button::Style {
                    background: Some(Background::Color(
                        if can_submit { ACCENT_AMBER } else { BG_ELEVATED },
                    )),
                    border: Border { color: BORDER, width: 1.0, radius: 4.0.into() },
                    text_color: if can_submit { Color::WHITE } else { TEXT_MUTED },
                    ..Default::default()
                })
                .padding([5, 16]),
            ]
            .align_y(Alignment::Center),
        ]
        .spacing(12)
        .padding(20),
    )
    .width(Length::Fixed(340.0))
    .style(|_| container::Style {
        background: Some(Background::Color(BG_SURFACE)),
        border: Border { color: BORDER, width: 1.0, radius: 8.0.into() },
        ..Default::default()
    });

    container(dialog)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .style(|_| container::Style {
            background: Some(Background::Color(Color::from_rgba(0.0, 0.0, 0.0, 0.6))),
            ..Default::default()
        })
        .into()
}
```

- [ ] **Step 2: Add `Message::SpawnFormWorkspace` and `Message::Noop` to `app.rs`**

In the `Message` enum, add two variants:

```rust
SpawnFormWorkspace(String),
Noop,
```

In `apply`, add two new match arms:

```rust
Message::SpawnFormWorkspace(v) => {
    if let Some(f) = &mut state.spawn_modal { f.workspace = v; }
    Task::none()
}

Message::Noop => Task::none(),
```

- [ ] **Step 3: Build to verify no errors**

```bash
cd athene && cargo build -p athene-app 2>&1 | grep "^error"
```

Expected: no output.

- [ ] **Step 4: Update existing spawn tests to include workspace**

In `app.rs` tests, update the two spawn-form tests so they set `workspace`:

```rust
// In spawn_form_confirm_inserts_orchestrator_and_navigates:
let (m, _) = m.update(Message::SpawnFormName("fix-bug".into()));
let (m, _) = m.update(Message::SpawnFormWorkspace("/tmp".into()));
let (m, _) = m.update(Message::SpawnFormConfirm);

// In spawn_form_cancel_clears_modal (no change needed — Cancel doesn't read workspace)
```

- [ ] **Step 5: Run tests**

```bash
cd athene && cargo test -p athene-app
```

Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add athene/crates/athene-app/src/components/spawn_modal.rs \
        athene/crates/athene-app/src/app.rs
git commit -m "feat(app): workspace field in spawn modal, Noop message"
```

---

## Task 5: Real session spawning

**Files:**
- Modify: `athene/crates/athene-app/src/app.rs`

**Interfaces:**
- Consumes: `athene_core::tmux::create_session`, `athene_core::tmux::list_sessions`, `athene_core::pty::start_streaming`
- Produces: `SpawnFormConfirm` launches a real tmux session with PTY streaming

---

- [ ] **Step 1: Replace `SpawnFormConfirm` in `apply`**

Find and replace the entire `Message::SpawnFormConfirm => { ... }` match arm with:

```rust
Message::SpawnFormConfirm => {
    if let Some(form) = state.spawn_modal.take() {
        let name      = form.name.trim().to_string();
        let workspace = form.workspace.trim().to_string();
        if name.is_empty() || workspace.is_empty() {
            return Task::none();
        }

        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        let orch = Orchestrator {
            id:         format!("orch-{ts}"),
            name:       name.clone(),
            created_at: ts as i64,
        };
        let _ = state.engine.store.upsert_orchestrator(&orch);
        state.orchestrators.push(orch.clone());
        state.engine.emit(Event::OrchestratorSpawned(orch.clone()));

        let session = Session {
            id:              orch.id.clone(),
            orchestrator_id: None,
            name:            name.clone(),
            repo:            String::new(),
            status:          SessionStatus::Working,
            agent_type:      "claude-code".into(),
            cost_usd:        0.0,
            started_at:      ts as i64,
            pr_number:       None,
            pr_id:           None,
            workspace_path:  Some(workspace.clone()),
            pid:             None,
        };
        let _ = state.engine.store.upsert_session(&session);
        state.sessions.insert(session.id.clone(), session.clone());
        state.engine.emit(Event::SessionSpawned(session));

        state.view = View::SessionDetail {
            session_id: orch.id.clone(),
            panel:      DetailPanel::Terminal,
        };

        // Capture values for the async task.
        let engine  = state.engine.clone();
        let tmux_id = orch.id.clone();
        let sid     = orch.id.clone();
        let ws      = workspace;
        let nm      = name;
        let ts_i64  = ts as i64;

        return Task::future(async move {
            use athene_core::{pty, tmux, Event as CoreEvent, Session, SessionStatus};

            if let Err(e) = tmux::create_session(&tmux_id, &ws, "claude", &[]).await {
                tracing::error!("tmux create failed for {sid}: {e}");
                return Message::Noop;
            }

            // Give the shell a moment to set up the TTY before we open it.
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

            let pid = tmux::list_sessions()
                .await
                .ok()
                .and_then(|ss| ss.into_iter().find(|s| s.id == tmux_id))
                .and_then(|s| s.pid);

            let updated = Session {
                id:              sid.clone(),
                orchestrator_id: None,
                name:            nm,
                repo:            String::new(),
                status:          SessionStatus::Working,
                agent_type:      "claude-code".into(),
                cost_usd:        0.0,
                started_at:      ts_i64,
                pr_number:       None,
                pr_id:           None,
                workspace_path:  Some(ws),
                pid,
            };
            let _ = engine.store.upsert_session(&updated);

            if let Err(e) = pty::start_streaming(engine.clone(), sid.clone(), &tmux_id).await {
                tracing::error!("pty setup failed for {sid}: {e}");
            }

            engine.emit(CoreEvent::SessionUpdated(updated));
            Message::Noop
        });
    }
    Task::none()
}
```

- [ ] **Step 2: Run tests**

```bash
cd athene && cargo test -p athene-app
```

Expected: all 8 tests pass (the Task::future is created but not driven in unit tests).

- [ ] **Step 3: Commit**

```bash
git add athene/crates/athene-app/src/app.rs
git commit -m "feat(app): spawn real tmux session with PTY streaming"
```

---

## Task 6: Startup state restore

**Files:**
- Modify: `athene/crates/athene-app/src/app.rs`

**Interfaces:**
- Consumes: `engine.store.list_orchestrators()`, `engine.store.list_sessions()`, `tmux::has_session`, `pty::start_streaming`
- Produces: `App::new()` pre-populates state from DB and returns a `Task` that reconnects live tmux sessions

---

- [ ] **Step 1: Write test for DB pre-population**

Add to the `tests` mod in `app.rs`:

```rust
#[test]
fn new_loads_sessions_and_orchestrators_from_db() {
    let store = Arc::new(
        Store::open(tempdir().unwrap().keep().join("t.db")).unwrap(),
    );
    store.upsert_orchestrator(&Orchestrator {
        id: "o1".into(), name: "test-orch".into(), created_at: 0,
    }).unwrap();
    store.upsert_session(&Session {
        id: "s1".into(), orchestrator_id: None, name: "w".into(),
        repo: "r".into(), status: SessionStatus::Working,
        agent_type: "c".into(), cost_usd: 0.0, started_at: 0,
        pr_number: None, pr_id: None, workspace_path: None, pid: None,
    }).unwrap();
    let engine = Engine::new(store);
    let (app, _task) = App::new(engine);
    assert_eq!(app.orchestrators.len(), 1);
    assert_eq!(app.sessions.len(), 1);
    assert!(app.sessions.contains_key("s1"));
}
```

- [ ] **Step 2: Run to verify failure**

```bash
cd athene && cargo test -p athene-app app::tests::new_loads_sessions_and_orchestrators_from_db 2>&1 | tail -5
```

Expected: test fails — `app.orchestrators` is empty.

- [ ] **Step 3: Update `App::new` to load from DB and reconnect PTY streams**

Replace the entire `pub fn new` in `app.rs`:

```rust
pub fn new(engine: Arc<Engine>) -> (Self, Task<Message>) {
    // Synchronously load persisted state from the DB so the UI isn't empty
    // on startup.
    let orchestrators = engine.store.list_orchestrators().unwrap_or_default();
    let sessions: HashMap<SessionId, Session> = engine
        .store
        .list_sessions()
        .unwrap_or_default()
        .into_iter()
        .map(|s| (s.id.clone(), s))
        .collect();

    let app = Self {
        engine:         engine.clone(),
        orchestrators,
        sessions,
        prs:            HashMap::new(),
        ci_status:      HashMap::new(),
        review_threads: HashMap::new(),
        notifications:  VecDeque::new(),
        sidebar:        SidebarState::default(),
        view:           View::default(),
        terminals:      HashMap::new(),
        spawn_modal:    None,
    };

    // Asynchronously reconnect PTY streams for sessions whose tmux sessions
    // are still live, and mark dead sessions as Terminated.
    let task = Task::future(async move {
        use athene_core::{pty, tmux, Event as CoreEvent, SessionStatus};

        let sessions = match engine.store.list_sessions() {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("restore: list_sessions: {e}");
                return Message::Noop;
            }
        };

        for session in sessions {
            if matches!(
                session.status,
                SessionStatus::Done | SessionStatus::Terminated
            ) {
                continue;
            }

            if tmux::has_session(&session.id).await {
                if let Err(e) = pty::start_streaming(
                    engine.clone(),
                    session.id.clone(),
                    &session.id,
                )
                .await
                {
                    tracing::warn!("reconnect pty {}: {e}", session.id);
                }
            } else {
                // Session is no longer running — mark it terminated.
                let mut dead = session.clone();
                dead.status = SessionStatus::Terminated;
                let _ = engine.store.upsert_session(&dead);
                engine.emit(CoreEvent::SessionUpdated(dead));
            }
        }

        Message::Noop
    });

    (app, task)
}
```

- [ ] **Step 4: Update the `base` helper in the tests mod to match the new field count**

The `base` helper in tests already sets `spawn_modal: None`. Verify it still compiles (no change needed if it was already complete).

- [ ] **Step 5: Run tests**

```bash
cd athene && cargo test -p athene-app
```

Expected: all 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add athene/crates/athene-app/src/app.rs
git commit -m "feat(app): restore sessions and orchestrators from DB on startup"
```

---

## Task 7: Terminate session — REST route + native message

**Files:**
- Modify: `athene/crates/athene-server/src/routes/sessions.rs`
- Modify: `athene/crates/athene-app/src/app.rs`

**Interfaces:**
- Consumes: `Engine::terminate_session`
- Produces: `DELETE /api/v1/sessions/:id` kills the tmux session; `Message::TerminateSession(SessionId)` does the same from the native UI

---

- [ ] **Step 1: Write REST terminate test**

Add to `sessions.rs` test module:

```rust
#[tokio::test]
async fn delete_returns_no_content() {
    let engine = test_engine();
    engine
        .store
        .upsert_session(&Session {
            id: "s1".into(), orchestrator_id: None, name: "w".into(),
            repo: "r".into(), status: SessionStatus::Working,
            agent_type: "c".into(), cost_usd: 0.0, started_at: 0,
            pr_number: None, pr_id: None, workspace_path: None, pid: None,
        })
        .unwrap();
    let response = sessions_router(engine)
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/s1")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}
```

- [ ] **Step 2: Run to verify the test currently passes vacuously**

```bash
cd athene && cargo test -p athene-server sessions::tests::delete_returns_no_content 2>&1 | tail -3
```

Expected: test passes (the stub already returns 204, but the termination logic is missing).

- [ ] **Step 3: Implement `terminate_session` in `sessions.rs`**

Replace the stub handler:

```rust
async fn terminate_session(
    State(e): State<Arc<Engine>>,
    Path(id): Path<String>,
) -> StatusCode {
    match e.terminate_session(&id).await {
        Ok(_) => StatusCode::NO_CONTENT,
        Err(err) => {
            tracing::error!("terminate {id}: {err}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}
```

- [ ] **Step 4: Add `Message::TerminateSession` to `app.rs`**

Add to the `Message` enum:

```rust
TerminateSession(SessionId),
```

Add handler in `apply`:

```rust
Message::TerminateSession(id) => {
    let engine = state.engine.clone();
    Task::future(async move {
        if let Err(e) = engine.terminate_session(&id).await {
            tracing::error!("terminate {id}: {e}");
        }
        Message::Noop
    })
}
```

- [ ] **Step 5: Run all tests**

```bash
cd athene && cargo test
```

Expected: all 18+ tests pass.

- [ ] **Step 6: Commit**

```bash
git add athene/crates/athene-server/src/routes/sessions.rs \
        athene/crates/athene-app/src/app.rs
git commit -m "feat(app,server): real terminate_session via Engine::terminate_session"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Tmux session created on spawn | Task 5 |
| Session name = `Session.id` | Tasks 1, 5 |
| PTY output → `Event::TerminalOutput` via FIFO + `AsyncFd` | Task 2 |
| PTY input → tmux pane TTY | Task 2 |
| Sessions survive app restart (tmux keeps running) | Tasks 1, 6 |
| Reconnect live sessions on startup | Task 6 |
| Dead sessions marked Terminated on startup | Task 6 |
| DB pre-populated on startup (no empty fleet board) | Task 6 |
| `Store::get_session` | Task 3 |
| `Engine::terminate_session` | Task 3 |
| `DELETE /api/v1/sessions/:id` kills tmux session | Task 7 |
| `Message::TerminateSession` for native UI | Task 7 |
| Spawn modal requires workspace field | Task 4 |
| `Message::Noop` for async Task returns | Task 4 |
