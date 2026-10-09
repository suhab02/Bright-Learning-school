// Minimal stand-in for Supabase's API gateway: /auth/v1 → Auth, /rest/v1 → PostgREST.
import http from "node:http";
const routes = [["/auth/v1", 9999], ["/rest/v1", 3001]];
http.createServer((req, res) => {
  const r = routes.find(([p]) => req.url.startsWith(p + "/") || req.url === p || req.url.startsWith(p + "?"));
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" });
    return res.end();
  }
  if (!r) { res.writeHead(404); return res.end("not routed"); }
  const headers = { ...req.headers };
  // like Kong: if no Authorization header, use the apikey as the bearer token
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const up = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers },
    (u) => { res.writeHead(u.statusCode, { ...u.headers, "access-control-allow-origin": "*" }); u.pipe(res); });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(8000, () => console.log("router on :8000"));
