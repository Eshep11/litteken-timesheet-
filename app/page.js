import { auth, currentUser } from "@clerk/nextjs/server";
import { getUser, getEmployees, getWeeks, getTimesheet } from "@/lib/db";
import { currentMonday } from "@/lib/dates";
import TimesheetApp from "./components/TimesheetApp";
import AccessCodeGate from "./components/AccessCodeGate";
import TopBar from "./components/TopBar";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const { userId, isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();

  const me = await getUser(userId);

  // No role yet → show the access-code gate.
  if (!me) {
    return (
      <main className="app">
        <TopBar name="" role="" />
        <AccessCodeGate />
      </main>
    );
  }

  const sp = await searchParams;
  const isBoss = me.role === "boss";

  // Whose sheets are we showing?
  let employees = [];
  let ownerId = me.clerk_id;
  let ownerName = me.name;

  if (isBoss) {
    employees = await getEmployees();
    const requestedEmp = sp?.emp;
    const found = employees.find((e) => e.clerk_id === requestedEmp);
    const target = found || employees[0] || null;
    if (target) {
      ownerId = target.clerk_id;
      ownerName = target.name;
    } else {
      ownerId = null; // no employees signed up yet
      ownerName = "";
    }
  }

  // Load weeks + selected sheet for the owner (if any).
  let weeks = [];
  let selected = currentMonday();
  let sheet = { week_start: selected, employee: "", data: [] };

  if (ownerId) {
    weeks = await getWeeks(ownerId);
    const requestedWeek = sp?.week;
    selected =
      (requestedWeek && weeks.includes(requestedWeek) && requestedWeek) ||
      weeks[0] ||
      currentMonday();
    sheet =
      (await getTimesheet(ownerId, selected)) || {
        week_start: selected,
        employee: "",
        data: [],
      };
  }

  return (
    <main className="app">
      <TopBar name={me.name} role={me.role} />
      <TimesheetApp
        isBoss={isBoss}
        employees={employees}
        ownerId={ownerId}
        ownerName={ownerName}
        initialWeeks={weeks}
        initialWeek={selected}
        initialSheet={sheet}
      />
    </main>
  );
}
