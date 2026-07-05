import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="auth-page">
      <div className="auth-intro">
        Create your Litteken Plumbing timesheet account. You'll enter your access
        code right after signing up.
      </div>
      <SignUp />
    </div>
  );
}
