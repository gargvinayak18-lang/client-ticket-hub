// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Load environment variables from .env manually so our API server middleware has access
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) {
        const [, key, val] = match;
        if (!process.env[key]) {
          process.env[key] = val.trim();
        }
      }
    });
  }
} catch (err) {
  console.error("Error reading local .env inside vite config:", err);
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    prerender: { enabled: true },
  },
  vite: {
    plugins: [
      {
        name: "local-vercel-api-emulation",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // Intercept /api/admin routing to match production Vercel serverless handler
            if (req.url?.split("?")[0] === "/api/admin") {
              try {
                const apiFilePath = path.resolve(process.cwd(), "api/admin.js");
                if (!fs.existsSync(apiFilePath)) {
                  throw new Error("Local API entrypoint api/admin.js not found");
                }
                
                // Dynamic load ESM module with cache-busting in dev
                const fileUrl = pathToFileURL(apiFilePath).href;
                const { default: handler } = await import(`${fileUrl}?update=${Date.now()}`);

                if (typeof handler !== "function") {
                  throw new Error("Default export in api/admin.js must be a function");
                }

                // Helper to accumulate JSON body chunks if any
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
                }
                const bodyString = Buffer.concat(chunks).toString("utf-8");
                
                // Shim standard Vercel/Express request/response methods
                (req as any).body = bodyString ? JSON.parse(bodyString) : {};
                
                const resProxy = res as any;
                resProxy.status = (code: number) => {
                  res.statusCode = code;
                  return resProxy;
                };
                resProxy.json = (data: any) => {
                  if (!res.headersSent) {
                    res.setHeader("Content-Type", "application/json");
                  }
                  res.end(JSON.stringify(data));
                  return resProxy;
                };

                // Invoke handler
                await handler(req, res);
              } catch (err: any) {
                console.error("API dev server error:", err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err.message || "Dev API handler execution error" }));
                }
              }
              return;
            }
            next();
          });
        },
      },
    ],
  },
});
