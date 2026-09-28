import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env.js";
import api, { initWgServerTunnel } from "./api/routes.js";

// env.ts validates configuration and throws immediately if something is
// missing — import it before anything else starts.
const app = new Hono();

app.get("/", (c) => {
  return c.text("metro-vpn exit node");
});

// Used by CI to verify the deployment (see deploy-exit-node_ec2.yml).
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/api", api);

await initWgServerTunnel();

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`Exit node API listening on http://127.0.0.1:${info.port}`);
    console.log("Put Caddy in front for HTTPS (deployment/Caddyfile).");
  },
);
