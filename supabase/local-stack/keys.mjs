// Prints dev-only anon/service JWTs signed with the local secret.
import { createHmac } from "node:crypto";
const secret = process.env.JWT_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, iss: "supabase-local", iat: 1700000000, exp: 2000000000 });
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
};
console.log(`ANON_KEY=${sign("anon")}\nSERVICE_KEY=${sign("service_role")}`);
