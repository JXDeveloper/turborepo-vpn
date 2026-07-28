import { serve } from "@hono/node-server";
import { Hono } from "hono";
import api from "./api/routes.js";

const app = new Hono();

app.get("/", (c) => {
  console.log("Hello Hono!");
  return c.text("Hello Hono!");
});

app.route("/api", api);

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT || 3001),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
