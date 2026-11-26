/* <<interface>> ProjectRepository (Deliverable 2 Diagram 1): findListing, findRequest, saveListing, saveRequest,
   plus the queries the pages need. The SQL for listings, memberships and requests is here. */
const { db } = require("../db");

const one = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);

// Reused SQL for a listing "l"
const SEATS = "(SELECT COUNT(*) FROM team_memberships x WHERE x.listing_id = l.listing_id AND x.status = 'Active') AS seats_taken";
const CREATOR = `JOIN team_memberships c ON c.listing_id = l.listing_id AND c.role = 'Creator'
                 JOIN students cs ON cs.student_id = c.student_id`;
const SECTION = "JOIN course_sections s ON s.section_id = l.section_id";

const ProjectRepository = {
  studentName: (id) => (one("SELECT name FROM students WHERE student_id = ?", id) || { name: "A student" }).name,

  // Project Listing
  findListing: (id) => one("SELECT * FROM project_listings WHERE listing_id = ?", Number(id)),
  saveListing: (listing) => run("UPDATE project_listings SET status = ? WHERE listing_id = ?", listing.status, listing.listing_id),

  //TeamMembership (creator is the row with role = 'Creator')
  activeMembers: (listingId) => all(`
    SELECT m.student_id, m.role, st.name FROM team_memberships m JOIN students st ON st.student_id = m.student_id
    WHERE m.listing_id = ? AND m.status = 'Active' ORDER BY m.role = 'Member', m.membership_id`, listingId),
  creatorId: (listingId) => (one("SELECT student_id FROM team_memberships WHERE listing_id = ? AND role = 'Creator'", listingId) || {}).student_id,
  addMembership: (listingId, studentId, role) =>
    run("INSERT INTO team_memberships (listing_id, student_id, role) VALUES (?, ?, ?)", listingId, studentId, role),

  // Student's active team in this section, if any
  activeTeamInSection: (studentId, sectionId) => one(`
    SELECT l.listing_id, l.title FROM team_memberships m JOIN project_listings l ON l.listing_id = m.listing_id
    WHERE m.student_id = ? AND m.status = 'Active' AND l.section_id = ? AND l.status IN ('Open', 'Full', 'Closed')`, studentId, sectionId),

  //Join Request
  findRequest: (id) => one("SELECT * FROM join_requests WHERE request_id = ?", Number(id)),
  saveRequest: (request) => run("UPDATE join_requests SET status = ?, decided_date = datetime('now') WHERE request_id = ?",
    request.status, request.request_id),
  pendingRequests: (listingId) => all("SELECT * FROM join_requests WHERE listing_id = ? AND status = 'Pending'", listingId),

  // Student's other pending requests in the same section
  pendingRequestsInSection: (studentId, sectionId, exceptListingId) => all(`
    SELECT r.* FROM join_requests r JOIN project_listings l ON l.listing_id = r.listing_id
    WHERE r.student_id = ? AND r.status = 'Pending' AND l.section_id = ? AND l.listing_id != ?`, studentId, sectionId, exceptListingId),

  // Queries for the pages
  // My Pings
  listingsCreatedBy: (studentId) => all(`
    SELECT l.listing_id, l.title, l.status, l.member_limit, s.course_code, s.section_code, ${SEATS},
      (SELECT COUNT(*) FROM join_requests r WHERE r.listing_id = l.listing_id AND r.status = 'Pending') AS pending_count
    FROM project_listings l ${CREATOR} ${SECTION} WHERE c.student_id = ? ORDER BY l.listing_id DESC`, studentId),

  // Creator's request board
  requestsFor: (listingId) => all(`
    SELECT r.request_id, r.status, r.message, r.request_date, r.student_id, st.name AS student_name
    FROM join_requests r JOIN students st ON st.student_id = r.student_id WHERE r.listing_id = ? ORDER BY r.request_id`, listingId)
};

module.exports = ProjectRepository;
