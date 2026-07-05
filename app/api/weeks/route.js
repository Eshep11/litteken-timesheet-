import { auth } from "@clerk/nextjs/server";
import { getUser, getWeeks } from "@/lib/db";

export async function GET(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUser(userId);
  if (!me) return Response.json({ error: "No access" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  if (!owner) return Response.json({ error: "Missing owner" }, { status: 400 });

  if (me.role !== "boss" && me.clerk_id !== owner) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const weeks = await getWeeks(owner);
  return Response.json({ weeks });
}
