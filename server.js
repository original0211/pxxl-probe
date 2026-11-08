// Zero-dependency probe v2: boot identity (cold-start detection) + /egress (origin location).
// If the platform restarts or wakes a fresh instance, boot_id changes and req_count resets.
const http = require('http');
const crypto = require('crypto');
const bootId = crypto.randomUUID();
const bootTime = Date.now();
let reqCount = 0;
let egressCache = null;

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pxxl-probe/2.0' } });
    return await r.json();
  } finally { clearTimeout(t); }
}

async function getEgress() {
  if (egressCache) return egressCache;
  const out = { egress_ip: null, geo: null, errors: [] };
  try {
    const ipRes = await fetchJson('https://api.ipify.org?format=json');
    out.egress_ip = ipRes.ip;
  } catch (e) { out.errors.push('ipify: ' + e.message); }
  if (!out.egress_ip) {
    try {
      const ipRes2 = await fetchJson('https://ifconfig.me/all.json');
      out.egress_ip = ipRes2.ip_addr;
    } catch (e) { out.errors.push('ifconfig: ' + e.message); }
  }
  if (out.egress_ip) {
    try {
      const g = await fetchJson('http://ip-api.com/json/' + out.egress_ip + '?fields=status,country,countryCode,regionName,city,isp,org,as,hosting,query');
      out.geo = g;
    } catch (e) { out.errors.push('geo: ' + e.message); }
  }
  if (out.egress_ip) egressCache = out;
  return out;
}

const server = http.createServer(async (req, res) => {
  reqCount++;
  const payload = {
    ok: true,
    service: 'pxxl-probe',
    version: 2,
    path: req.url,
    boot_id: bootId,
    pid: process.pid,
    boot_time_iso: new Date(bootTime).toISOString(),
    now_iso: new Date().toISOString(),
    uptime_s: Math.round((Date.now() - bootTime) / 1000),
    req_count: reqCount,
    node: process.version
  };
  if (req.url.startsWith('/egress')) {
    payload.egress = await getEgress();
  }
  const body = JSON.stringify(payload);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
});
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log('pxxl-probe listening on ' + port + ' boot_id=' + bootId));
