/* My Pings: the creator's request board (ProjectBoardView, creator side).
   The creator submits a decision, ProjectRequestController.processDecision
   decides what changes, and the page reloads because one approval can change several requests. */
let selectedId = Number(new URLSearchParams(location.search).get("listing")) || null;

const listBox = document.getElementById("list");
const detailBox = document.getElementById("detail");

async function load() {
  const myPings = await api("GET", "/api/my/listings");
  if (!myPings.length) {
    render(listBox, h("p", { className: "empty" }, "You haven't posted any Project Pings."));
    return render(detailBox, h("div", { className: "panel" }, "Post one from your class channel.")); 
  }
  if (!myPings.some((l) => l.listing_id === selectedId)) selectedId = myPings[0].listing_id;

  render(listBox, myPings.map((l) =>
    h("button", { className: "side-item" + (l.listing_id === selectedId ? " selected" : ""), onClick: () => select(l.listing_id) },
      h("strong", null, l.title),
      h("div", { className: "actions" }, statusPill(l.status),
        h("span", { className: "small-label" }, `${l.course_code} ${l.section_code} · ${l.seats_taken}/${l.member_limit}`),
        l.pending_count > 0 && h("span", { className: "pill pill-pending" }, `${l.pending_count} pending`)))));

  const { listing, members, requests } = await api("GET", `/api/listings/${selectedId}/board`);
  const board = h("main", { className: "board" });
  render(detailBox,
    h("div", { className: "panel" },
      h("div", { className: "detail-head" },
        h("div", null, h("h2", null, listing.title),
          h("p", { className: "meta" }, `${listing.course_code} ${listing.section_code} · ${listing.seats_taken} of ${listing.member_limit} seats filled`)),
        statusPill(listing.status)),
      h("p", { className: "desc" }, listing.description || "No description."),
      h("div", { className: "members" }, members.map((m) => h("span", { className: "chip" }, m.name + (m.role === "Creator" ? " (you)" : "")))),
      listing.status === "Full" && h("p", { className: "note" }, "Your team is full. Remaining requests were declined and the team chat is open in My teams.")),
    board);
  renderBoard(board, ["Pending", "Approved", "Declined", "Withdrawn"], requests, (r) => requestCard(r, listing));
}

function requestCard(r, listing) {
  return h("article", { className: "card" },
    h("h3", null, r.student_name),
    h("p", { className: "meta" }, formatTime(r.request_date)),
    r.message && h("p", { className: "desc" }, "“" + r.message + "”"),
    r.status === "Pending" && !r.still_enrolled && h("p", { className: "warn" }, "No longer enrolled in this section"),
    r.status === "Pending" && h("div", { className: "actions" }, // only the moves the state table allows
      h("button", { className: "btn-small-primary", disabled: listing.status !== "Open", onClick: () => decide(r.request_id, "approve") }, "Approve"),
      h("button", { className: "btn-delete", onClick: () => decide(r.request_id, "decline") }, "Decline")));
}

function select(id) {
  selectedId = id;
  history.replaceState(null, "", "?listing=" + id);
  load();
}

// submitDecision(requestId, decision) -> processDecision on the server
async function decide(requestId, decision) {
  await attempt(async () => {
    const result = await api("POST", `/api/requests/${requestId}/decision`, { decision });
    toast(result.becameFull ? "Team is full! Remaining requests were declined and the team chat is open." : result.status, "ok");
  });
  load(); // reload even after an error, in case something else changed
}

initPage().then(() => {
  load();
  setInterval(load, 10000); // new requests show up within 10 seconds
});
