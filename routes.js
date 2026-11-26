/* HTTP API: the server side of the <<boundary>> views (ProjectBoardView, ChatView).
   Each route reads the request, calls a controller and returns JSON*/
const { route, HttpError } = require("./router");
const { db } = require("./db");
const PRC = require("./controllers/ProjectRequestController");
const ChatController = require("./controllers/ChatController");
const EnrollmentController = require("./controllers/EnrollmentController");
const repo = require("./repositories/ProjectRepository");

// Nothing except the login page works without a session
function requireLogin(req, res, next) {
  req.student = req.studentId && db.prepare("SELECT * FROM students WHERE student_id = ?").get(req.studentId);
  if (!req.student) throw new HttpError(401, "Please log in first", "LOGIN_REQUIRED");
  req.me = req.student.student_id;
  return next();
}

function requireConduct(req, res, next) {
  ChatController.requireConduct(req.me);
  return next();
}

// the handler returns the JSON to send back
const get = (path, fn, ...checks) => route("GET", path, requireLogin, ...checks, (req, res) => res.json(fn(req)));
const post = (path, fn, ...checks) => route("POST", path, requireLogin, ...checks, (req, res) => res.json(fn(req) || { ok: true }));


//Simulated Passport York login
route("GET", "/api/students", (req, res) => res.json(db.prepare("SELECT student_id, name, email FROM students ORDER BY name").all()));
route("POST", "/api/login", (req, res) => {
  const student = db.prepare("SELECT student_id FROM students WHERE student_id = ?").get(Number(req.body.studentId));
  if (!student) throw new HttpError(400, "Pick a student from the list");
  EnrollmentController.syncChatMemberships(student.student_id);
  req.login(student.student_id);
  res.json({ ok: true });
});
route("POST", "/api/logout", (req, res) => { req.logout(); res.json({ ok: true }); });

get("/api/me", (req) => ({
  id: req.me, name: req.student.name, email: req.student.email,
  conductAccepted: ChatController.hasAcceptedCurrent(req.me)
}));

// Project Ping, creator side: ProjectBoardView -> ProjectRequestController
post("/api/requests/:id/decision", (req) => PRC.processDecision(req.student, req.params.id, req.body.decision), requireConduct); // submitDecision
get("/api/listings/:id/board", (req) => PRC.board(req.student, req.params.id), requireConduct);
get("/api/my/listings", (req) => repo.listingsCreatedBy(req.me), requireConduct);


