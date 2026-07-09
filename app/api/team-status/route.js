import { auth } from "@clerk/nextjs/server";
import { getUser, getTeamStatus } from "@/lib/db";

// Boss-only. Returns every employee's submission status for one week —
// powers the "who hasn't submitted" list. Managers are never included.
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUser(userId);
  if (!me || me.role !== "boss") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  if (!week) return Response.json({ error: "Missing week" }, { status: 400 });

  const employees = await getTeamStatus(week);
  return Response.json({ week, employees });
}
