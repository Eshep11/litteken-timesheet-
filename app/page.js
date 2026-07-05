import { isEditor } from "@/lib/session";
import { getWeeks, getTimesheet } from "@/lib/db";
import { currentMonday } from "@/lib/dates";
import TimesheetApp from "./components/TimesheetApp";
import AuthControls from "./components/AuthControls";

// Always render fresh (this is a live, editable document).
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const editor = await isEditor();

  const sp = await searchParams;
  const weeks = await getWeeks();

  // Which week to show first: ?week=... if valid, else newest, else this week.
  const requested = sp?.week;
  const selected =
    (requested && weeks.includes(requested) && requested) ||
    weeks[0] ||
    currentMonday();

  const sheet =
    (await getTimesheet(selected)) || {
      week_start: selected,
      employee: "",
      data: [],
    };

  return (
    <main className="app">
      <div className="topbar no-print">
        <div className="topbar-title">Litteken Plumbing — Time Sheets</div>
        <AuthControls isEditor={editor} />
      </div>
      <TimesheetApp
        initialWeeks={weeks}
        initialWeek={selected}
        initialSheet={sheet}
        isOwner={editor}
      />
    </main>
  );
}
