import { verifySignature } from "@my-vpn/crypto-utils";
import { Hono, type Handler} from "hono";
import { createMiddleware } from "hono/factory";

interface payload {
  signature: string,
  data: {
    str: string,
  }
}

const api = new Hono();

const ControlPanelAuthMiddleware = createMiddleware(async (c, next) => {
  const secret = process.env.BACKEND_API_SECRET;
  if(!secret) {
    throw new Error(`unable to load env createPeer`);
  }
  const body = await c.req.json<payload>();
  if(!await verifySignature(secret, body.data.str+'1', body.signature)) {
    return c.json({message: "u are not authored to request this endpoint"}, 403);
  }
  
  return await next();
});

const createPeer: Handler = async (c) => {;
  console.log("get to this");
  return c.json({message: "all good create peer"});
}

const revokePeer: Handler = (c) => {
  const secret = process.env.BACKEND_API_SECRET;
  if(!secret) {
    throw new Error(`unable to load env deletePeer`);
  }
  
  return c.json({message: "all good delete peer"});
}
api.use("*", ControlPanelAuthMiddleware);

api.post("", createPeer);
api.delete("", revokePeer);


export default api;
