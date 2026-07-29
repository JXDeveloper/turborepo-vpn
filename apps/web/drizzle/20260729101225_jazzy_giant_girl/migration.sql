CREATE TABLE "exit_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"public_key" text NOT NULL,
	"public_ip" text NOT NULL,
	"port_no" integer NOT NULL
);
