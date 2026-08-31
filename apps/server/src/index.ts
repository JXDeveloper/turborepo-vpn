import { serve } from "@hono/node-server";
import { Hono } from "hono";
import api, { initWgServerTunnel } from "./api/routes.js";

const app = new Hono();

app.get("/", (c) => {
  console.log("Hello Hono!");
  return c.text("Hello Hono!");
});

app.route("/api", api);

await initWgServerTunnel();

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT || 443),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
