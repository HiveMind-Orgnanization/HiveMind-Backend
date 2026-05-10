const http = require("node:http");
const port = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if ((req.url || "").startsWith("/health")) {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "stub_backend" }));
}).listen(port, "127.0.0.1", () => {});
