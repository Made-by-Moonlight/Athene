import { render, screen, fireEvent } from "@testing-library/react";
import { FleetBoard } from "../FleetBoard";
import type { DashboardSession } from "@/lib/types";

vi.mock("@/hooks/useSessionEvents", () => ({
  useSessionEvents: vi.fn(),
}));
vi.mock("../FleetColumn", () => ({
  FleetColumn: ({ title, groups }: { title: string; groups: unknown[] }) => (
    <div data-testid={`col-${title.toLowerCase()}`}>{groups.length} groups</div>
  ),
}));
vi.mock("../FleetFilterBar", () => ({
  FleetFilterBar: ({
    orchestratorNames,
    onFilterChange,
  }: {
    orchestratorNames: string[];
    onFilterChange: (n: string | null) => void;
  }) => (
    <div>
      {orchestratorNames.map((n) => (
        <button key={n} onClick={() => onFilterChange(n)}>
          {n}
        </button>
      ))}
      <button onClick={() => onFilterChange(null)}>All</button>
    </div>
  ),
}));

import { useSessionEvents } from "@/hooks/useSessionEvents";

function makeSession(
  id: string,
  opts: {
    role?: string;
    parentSessionId?: string;
    orchestratorOwner?: string;
    attentionLevel?: string;
  } = {},
): DashboardSession {
  return {
    id,
    projectId: "proj-1",
    metadata: {
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.parentSessionId ? { parentSessionId: opts.parentSessionId } : {}),
      ...(opts.orchestratorOwner ? { orchestratorOwner: opts.orchestratorOwner } : {}),
    },
    attentionLevel: (opts.attentionLevel ?? "working") as never,
    createdAt: new Date().toISOString(),
    status: "working" as never,
    activity: null,
    branch: null,
    issueId: null,
    issueUrl: null,
    issueLabel: null,
    issueTitle: null,
    userPrompt: null,
    displayName: null,
    displayNameUserSet: false,
    summary: null,
    summaryIsFallback: false,
    lastActivityAt: new Date().toISOString(),
    pr: null,
    prs: [],
  };
}

describe("FleetBoard", () => {
  beforeEach(() => {
    vi.mocked(useSessionEvents).mockReturnValue({ sessions: [], isConnected: true } as never);
  });

  it("filters out orchestrator sessions", () => {
    vi.mocked(useSessionEvents).mockReturnValue({
      sessions: [
        makeSession("orch-1", { role: "orchestrator" }),
        makeSession("worker-1", { parentSessionId: "orch-1", orchestratorOwner: "fleet-meta" }),
      ],
      isConnected: true,
    } as never);
    render(<FleetBoard initialSessions={[]} />);
    // 1 worker should appear across the columns (orch-1 filtered out)
    // The working column gets 1 group with 1 session
    expect(screen.getByTestId("col-working")).toHaveTextContent("1 groups");
  });

  it("groups workers by parentSessionId", () => {
    vi.mocked(useSessionEvents).mockReturnValue({
      sessions: [
        makeSession("w-1", { parentSessionId: "orch-A", orchestratorOwner: "alpha" }),
        makeSession("w-2", { parentSessionId: "orch-A", orchestratorOwner: "alpha" }),
        makeSession("w-3", { parentSessionId: "orch-B", orchestratorOwner: "beta" }),
      ],
      isConnected: true,
    } as never);
    render(<FleetBoard initialSessions={[]} />);
    // Working column: 2 distinct groups (orch-A and orch-B)
    expect(screen.getByTestId("col-working")).toHaveTextContent("2 groups");
  });

  it("filters groups by orchestratorName when filter is set", () => {
    vi.mocked(useSessionEvents).mockReturnValue({
      sessions: [
        makeSession("w-1", { parentSessionId: "orch-A", orchestratorOwner: "alpha" }),
        makeSession("w-2", { parentSessionId: "orch-B", orchestratorOwner: "beta" }),
      ],
      isConnected: true,
    } as never);
    render(<FleetBoard initialSessions={[]} />);
    fireEvent.click(screen.getByText("alpha"));
    // After filtering to alpha, only 1 group
    expect(screen.getByTestId("col-working")).toHaveTextContent("1 groups");
  });
});
