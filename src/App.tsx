import { Suspense } from "react";
import { Outlet } from "react-router";
import { Header } from "./components/Header";
import { m } from "./paraglide/messages.js";

export function AppLayout() {
  return (
    <div className="ocean-bg h-screen supports-[height:100dvh]:h-dvh flex flex-col overflow-hidden">
      {/* first focusable element on every route */}
      <a href="#main" className="skip-link">
        {m["common.skipToContent"]()}
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto">
        {/* single boundary for the lazy route chunks (OrgPage, AdminPage — D10) */}
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
