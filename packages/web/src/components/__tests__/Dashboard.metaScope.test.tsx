import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Dashboard } from "@/components/Dashboard";
import { makeSession } from "@/__tests__/helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/meta/meta-1",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Dashboard meta-board scope", () => {
  beforeEach(() => {
    global.EventSource = vi.fn(
      () =>
        ({ onmessage: null, onerror: null, close: vi.fn() }) as unknown as EventSource,
    );
    global.fetch = vi.fn();
  });

  it("shows only the meta orchestrator's owned fleet, not the whole portfolio", () => {
    // `useSessionEvents` seeds from initialSessions and (post-SSE) holds ALL
    // projects' sessions. With metaOwner set, the kanban must self-restrict to
    // metaOwner === "meta-1" — even though unowned sessions are in the list.
    render(
      <Dashboard
        metaOwner="meta-1"
        projects={[
          { id: "web", name: "Web", sessionPrefix: "web" },
          { id: "api", name: "Api", sessionPrefix: "api" },
        ]}
        initialSessions={[
          makeSession({
            id: "web-1",
            projectId: "web",
            ownerKind: "meta",
            metaOwner: "meta-1",
            summary: "Owned by meta-1",
          }),
          makeSession({
            id: "api-9",
            projectId: "api",
            ownerKind: "project",
            metaOwner: null,
            summary: "Project-owned peer",
          }),
          makeSession({
            id: "web-2",
            projectId: "web",
            ownerKind: "meta",
            metaOwner: "other-meta",
            summary: "Owned by a different meta",
          }),
        ]}
      />,
    );

    const board = document.querySelector(".kanban-board");
    expect(board).toBeTruthy();
    const boardText = board!.textContent ?? "";
    // Only the meta-1-owned session appears on the board.
    expect(boardText).toContain("web-1");
    expect(boardText).not.toContain("api-9");
    expect(boardText).not.toContain("web-2");
  });
});
