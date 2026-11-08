// Zero-dependency probe: exposes boot identity so cold-start / spin-down is detectable.
// If the platform restarts or wakes a fresh instance, boot_id changes and req_count resets.
const http = require('http');
const crypto = require('crypto');
const bootId = crypto.randomUUID();
const bootTime = Date.now();
let reqCount = 0;
const server = http.createServer((req, res) => {
  reqCount++;
  const payload = {
    ok: true,
    service: 'pxxl-probe',
    path: req.url,
    boot_id: bootId,
    pid: process.pid,
    boot_time_iso: new Date(bootTime).toISOString(),
    now_iso: new Date().toISOString(),
    uptime_s: Math.round((Date.now() - bootTime) / 1000),
    req_count: reqCount,
    node: process.version
  };
  const body = JSON.stringify(payload);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
});
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log('pxxl-probe listening on ' + port + ' boot_id=' + bootId));
