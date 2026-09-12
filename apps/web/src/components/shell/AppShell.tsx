import { Outlet } from "react-router";

/** App frame. Task 7 adds sidebar (desktop) + bottom nav (mobile) per CLAUDE.md §9. */
export function AppShell() {
  return (
    <main id="content" className="mx-auto max-w-5xl p-4 md:p-8">
      <Outlet />
    </main>
  );
}
