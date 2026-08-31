import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, useRouteError } from "react-router";
import { RouterProvider } from "react-router/dom";
// Self-hosted IBM Plex Mono — the single Corda typeface (no CDN). Weights:
// 300 body · 400/500 labels · 600 buttons · 700 headings.
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
// the plain asset import resolves to the same hashed URL the @fontsource
// CSS references, so this preload never double-downloads
import plexMono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
import "./styles.css";
import { m } from "./paraglide/messages.js";
import { AppLayout } from "./App";
import { MapPage } from "./pages/MapPage";
import { CardsPage } from "./pages/CardsPage";
import { AboutPage } from "./pages/AboutPage";

// preload the primary face (woff2 only) so text doesn't wait on CSS parse + layout
{
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";
  link.href = plexMono400;
  document.head.append(link);
}

// secondary routes are split out of the entry chunk (D10); the map route stays
// eager — it IS the landing page
const OrgPage = React.lazy(() =>
  import("./pages/OrgPage").then((m) => ({ default: m.OrgPage }))
);
const AdminPage = React.lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))
);

/** Friendly fallback for unknown URLs and runtime route errors. */
function Fallback({ is404 }: { is404: boolean }) {
  return (
    <div className="ocean-bg min-h-full grid place-items-center py-16">
      <div className="text-center px-6">
        <p className="eyebrow mb-3">{is404 ? m["notFound.eyebrow404"]() : m["notFound.eyebrowError"]()}</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {is404 ? m["notFound.heading404"]() : m["notFound.headingError"]()}
        </h1>
        <p className="mt-2" style={{ color: "var(--ink-50)" }}>
          {is404 ? m["notFound.body404"]() : m["notFound.bodyError"]()}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <a href="/" className="btn-corda-primary px-6 py-3">
            {m["notFound.backToMap"]()}
          </a>
          <a href="/?edit=1" className="btn-corda px-6 py-3">
            {m["notFound.openEditor"]()}
          </a>
        </div>
      </div>
    </div>
  );
}

/** Error boundary element: a thrown 404 from the router, or a runtime error. */
function RouteFallback() {
  const error = useRouteError() as { status?: number } | undefined;
  return <Fallback is404={error?.status === 404} />;
}

/** /edit → the map with the layout editor enabled (needs a full navigation so
 * the ?edit=1 query is present when the map reads it). */
function EditRedirect() {
  React.useEffect(() => {
    window.location.replace("/?edit=1");
  }, []);
  return null;
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteFallback />,
    children: [
      { path: "/", element: <MapPage /> },
      { path: "/edit", element: <EditRedirect /> },
      { path: "/cards", element: <CardsPage /> },
      { path: "/org/:slug", element: <OrgPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "*", element: <Fallback is404 /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
