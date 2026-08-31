import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Dev-only endpoint: the ?edit=1 layout editor POSTs here to bake the
 * manual node/label layout into src/data/layout.json. */
function layoutSaver(): Plugin {
  return {
    name: "layout-saver",
    configureServer(server) {
      server.middlewares.use("/__save-layout", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed !== "object" || !parsed.nodes || !parsed.labels) throw new Error("bad shape");
            fs.writeFileSync(
              path.join(root, "src/data/layout.json"),
              JSON.stringify(parsed, null, 2) + "\n"
            );
            res.end("ok");
          } catch {
            res.statusCode = 400;
            res.end("invalid layout json");
          }
        });
      });
    },
  };
}

/** Absolute-URL meta (og:url/og:image) from SITE_URL at build time — the host
 * never lives in the repo. Unset SITE_URL strips those tags (scrapers need
 * absolute URLs anyway). */
function siteUrlMeta(): Plugin {
  const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  return {
    name: "site-url-meta",
    transformIndexHtml(html) {
      if (!site) return html.replace(/^.*__SITE_URL__.*\n/gm, "");
      return html.replaceAll("__SITE_URL__", site);
    },
  };
}

export default defineConfig({
  plugins: [
    // messages compile to src/paraglide (gitignored); `bun run paraglide` does
    // the same for the standalone tsc -b step
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["baseLocale"],
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    layoutSaver(),
    siteUrlMeta(),
    // ANALYZE=1 only: anything under dist/ is published as a static asset
    process.env.ANALYZE
      ? visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true })
      : null,
  ],
  server: { port: 5199 },
  build: {
    rollupOptions: {
      output: {
        // D10: function form (object form is gone in Vite 8/Rolldown); stable
        // vendor-react chunk = long-lived cache hits across deploys
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
