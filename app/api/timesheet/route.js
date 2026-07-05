import { getTimesheet } from "@/lib/db";

// Public, read-only. Anyone can fetch a week's timesheet to view it.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  if (!week) {
    return Response.json({ error: "Missing week" }, { status: 400 });
  }
  const sheet = await getTimesheet(week);
  if (!sheet) {
    return Response.json({ week_start: week, employee: "", data: [] });
  }
  return Response.json(sheet);
}
