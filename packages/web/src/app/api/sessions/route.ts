import { listSessions } from "@/lib/engine-client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project") ?? undefined;
  const sessions = await listSessions(projectId);
  return Response.json({ sessions, stats: null, orchestratorId: null, orchestrators: [] });
}
