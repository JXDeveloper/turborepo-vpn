import { pgTable, text, integer, uuid } from "drizzle-orm/pg-core";

export const exitNodes = pgTable("exit_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicKey: text("public_key").notNull(),
  publicIp: text("public_ip").notNull(),
  portNo: integer("port_no").notNull(),
});
