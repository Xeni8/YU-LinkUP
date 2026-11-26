/* Express-style router on top of Node's built-in http module.
   route("POST", "/api/requests/:id/approve", requireLogin, handler) works like app.post(...) */
const crypto = require("node:crypto");

const routes = [];
const sessions = new Map(); // session id -> student id (in memory: restarting the server logs everyone out)

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function route(method, pattern, ...handlers) {
  const keys = [];
  const regex = new RegExp(
    "^" + pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return "([^/]+)"; }) + "$"
  );
  routes.push({ method, regex, keys, handlers });
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) reject(new HttpError(413, "Request too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new HttpError(400, "Body must be valid JSON")); }
    });
    req.on("error", reject);
  });
}

// Adds res.status(...).json(...) like Express
function addHelpers(req, res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };

  const cookies = parseCookies(req.headers.cookie);
  req.studentId = sessions.get(cookies.sid) || null;
  req.login = (studentId) => {
    const sid = crypto.randomUUID();
    sessions.set(sid, studentId);
    res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; Path=/; SameSite=Lax`);
  };
  req.logout = () => {
    sessions.delete(cookies.sid);
    res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  };
}

// Returns true if an API route handled the request
async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const match = routes.find((r) => r.method === req.method && r.regex.test(url.pathname));
  if (!match) return false;

  addHelpers(req, res);
  const values = url.pathname.match(match.regex).slice(1);
  req.params = Object.fromEntries(match.keys.map((k, i) => [k, decodeURIComponent(values[i])]));
  req.query = Object.fromEntries(url.searchParams);

  try {
    req.body = req.method === "GET" ? {} : await readJson(req);
    // Run middleware and the handler in order; each must call next() to continue
    let i = 0;
    const next = () => {
      const handler = match.handlers[i++];
      if (handler) return handler(req, res, next);
    };
    await next();
  } catch (err) {
    if (typeof err.status === "number") { // HttpError or RuleError: a known, expected refusal
      res.status(err.status).json({ error: err.message, code: err.code, rule: err.rule });
    } else {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
  return true;
}

module.exports = { route, handleApi, HttpError };
