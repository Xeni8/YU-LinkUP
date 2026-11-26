/* Shared by every page: the api() helper, h(), boards, toasts and the nav bar. */

// Talks to the server. Throws an Error with the server's message and rule ID if an action is refused.
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (res.ok) return data;
  if (data && data.code === "LOGIN_REQUIRED") location.href = "/login.html";
  if (data && data.code === "CONDUCT_REQUIRED") location.href = "/conduct.html";
  const err = new Error((data && data.error) || "Something went wrong");
  err.rule = data && data.rule; 
  throw err;
}

/* same idea as h = React.createElement */
function h(type, props, ...children) {
  const el = document.createElement(type);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "className") el.className = value;
    else if (typeof value === "boolean") el[key] = value; // disabled, hidden
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// Replaces everything inside a container (the "redraw from state" step)
const render = (container, ...children) => container.replaceChildren(...children.flat().filter(Boolean));

/* renderBoard: the planner's TaskColumn, reused for any status board.
   columns: list of status names, items: objects with a .status, card: item -> element */
function renderBoard(container, columns, items, card) {
  render(container, columns.map((status) => {
    const inColumn = items.filter((item) => item.status === status);
    return h("section", { className: "column column-" + status.toLowerCase() },
      h("div", { className: "column-head" }, h("h2", null, status), h("span", { className: "count" }, inColumn.length)),
      inColumn.length ? inColumn.map(card) : h("p", { className: "empty" }, "None yet."));
  }));
}

const statusPill = (status) => h("span", { className: "pill pill-" + status.toLowerCase() }, status);

// SQLite formatting
const formatTime = (t) => new Date(t.replace(" ", "T") + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Short message at the bottom of the screen
function toast(text, kind = "error") {
  const box = document.getElementById("toast") || document.body.appendChild(h("div", { id: "toast", role: "status" }));
  box.className = `toast toast-${kind} show`;
  box.textContent = text;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => box.classList.remove("show"), 3500);
}

// Runs an action; if a rule refuses it, shows the reason and the rule ID
async function attempt(fn, successText) {
  try {
    await fn();
    if (successText) toast(successText, "ok");
    return true;
  } catch (err) {
    toast(err.rule ? `${err.message} (${err.rule})` : err.message);
    return false;
  }
}


// Nav Bar
const NAV_LINKS = [
  ["/mypings.html", "My Pings"]
];

// Every signed-in page calls this first. Sends the student to the Code of Conduct if needed.
async function initPage() {
  const me = await api("GET", "/api/me");
  if (!me.conductAccepted) {
    location.href = "/conduct.html";
    return new Promise(() => {}); // stop the page while redirecting
  }
  const logout = async () => { await api("POST", "/api/logout"); location.href = "/login.html"; };

  render(document.getElementById("nav"), h("div", { className: "nav-inner" },
    h("a", { className: "brand", href: "/mypings.html" }, "YU Link Up"),
    h("nav", null, NAV_LINKS.map(([href, label]) => h("a", { href, className: location.pathname === href ? "active" : null }, label))),
    h("div", { className: "nav-right" },

      h("span", { className: "who" }, me.name),
      h("button", { onClick: logout }, "Log out"))));

  return me;
}
