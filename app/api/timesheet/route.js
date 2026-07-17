import { auth } from "@clerk/nextjs/server";
import { getUser, getTimesheet } from "@/lib/db";
import { isLocked } from "@/lib/lock";

export async function GET(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUser(userId);
  if (!me) return Response.json({ error: "No access" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const week = searchParams.get("week");
  if (!owner || !week) {
    return Response.json({ error: "Missing owner or week" }, { status: 400 });
  }

  // Employees may only read their own sheets.
  if (me.role !== "boss" && me.clerk_id !== owner) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const sheet = await getTimesheet(owner, week);
  if (!sheet) {
    return Response.json({
      week_start: week,
      employee: "",
      data: [],
      created_at: null,
      submitted_at: null,
      photo: null,
      locked: false,
    });
  }
  return Response.json({ ...sheet, locked: isLocked(week, sheet.submitted_at) });
}
