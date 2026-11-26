/* Resets the database and fills it with mock data */
const { db, createSchema, transaction } = require("./db");
const { DB_PATH } = require("./config");

// Drop and recreate the tables in place, so running server sees the fresh data
db.exec("PRAGMA foreign_keys = OFF");
for (const table of ["notifications", "messages", "chat_memberships", "chats", "join_requests", "team_memberships",
                     "project_listings", "enrollments", "course_sections", "conduct_acceptances", "code_of_conduct",
                     "students"]) {
  db.exec(`DROP TABLE IF EXISTS ${table}`);
}
db.exec("PRAGMA foreign_keys = ON");
createSchema();

const EnrollmentController = require("./controllers/EnrollmentController");
const ChatRepository = require("./repositories/ChatRepository");

const CONDUCT_RULES = [
  "Be respectful. No harassment, hate speech or personal attacks.",
  "Only post content related to your courses, projects and campus life.",
  "Do not share other students' personal information.",
  "Follow York University's academic honesty policy: team chats are for collaboration, not sharing graded answers.",
  "Report problems to a moderator instead of escalating them in chat."
];

// accepted = already accepted Code of Conduct 
const students = [
  { id: 1, name: "Madison Cross", accepted: true },
  { id: 2, name: "Ben Tran", accepted: true },
  { id: 3, name: "Chloe Martin", accepted: true },
  { id: 4, name: "Aston Barnes", accepted: true },
  { id: 5, name: "Roger Myers", accepted: false },
  { id: 6, name: "Bianca Wood", accepted: true },
  { id: 7, name: "Noah Kim", accepted: true },
  { id: 8, name: "Jenna King", accepted: false }
];

// max_group_size = the largest team the course allows 
const sections = [
  { id: 1, course: "ITEC 4010", section: "A", title: "Systems Analysis and Design II", max: 4 },
  { id: 2, course: "ITEC 3505", section: "A", title: "Project Management", max: 2 },
  { id: 3, course: "ITEC 4030", section: "B", title: "Business Process Management", max: 3 },
  { id: 4, course: "ITEC 4020", section: "A", title: "Internet Client-Server Systems", max: 4 }
];

// section id -> [student id, status]
const enrollments = {
  1: [[1, "Enrolled"], [2, "Enrolled"], [3, "Enrolled"], [4, "Enrolled"], [5, "Enrolled"],
      [6, "Enrolled"], [7, "Dropped"], [8, "Enrolled"]], // Noah dropped ITEC 4010
  2: [[1, "Enrolled"], [2, "Enrolled"], [4, "Enrolled"], [5, "Enrolled"], [7, "Enrolled"], [8, "Enrolled"]],
  3: [[3, "Enrolled"], [4, "Enrolled"], [6, "Enrolled"], [7, "Enrolled"], [8, "Enrolled"]],
  4: [[1, "Enrolled"], [2, "Enrolled"], [3, "Enrolled"], [5, "Enrolled"], [6, "Enrolled"]]
};

transaction(() => {
  db.prepare("INSERT INTO code_of_conduct (version, published_date, rules) VALUES ('1.0', '2026-09-01', ?)")
    .run(JSON.stringify(CONDUCT_RULES));

  for (const s of students) {
    const email = s.name.toLowerCase().replace(" ", ".") + "@my.yorku.ca";
    db.prepare("INSERT INTO students (student_id, name, email) VALUES (?, ?, ?)").run(s.id, s.name, email);
    if (s.accepted) {
      db.prepare("INSERT INTO conduct_acceptances (student_id, version, accepted_at) VALUES (?, '1.0', '2026-09-08 12:00:00')").run(s.id);
    }
  }
  for (const s of sections) {
    db.prepare(`INSERT INTO course_sections (section_id, course_code, section_code, title, term, max_group_size)
                VALUES (?, ?, ?, ?, 'Fall 2026', ?)`).run(s.id, s.course, s.section, s.title, s.max);
  }
  for (const [sectionId, rows] of Object.entries(enrollments)) {
    for (const [studentId, status] of rows) {
      db.prepare("INSERT INTO enrollments (student_id, section_id, enrolled_date, status) VALUES (?, ?, '2026-08-20', ?)")
        .run(studentId, Number(sectionId), status);
    }
  }

  // Create every class channel and add enrolled students (what happens at each login)
  for (const s of students) EnrollmentController.syncChatMemberships(s.id);
  const channel = (sectionId) => ChatRepository.findCourseChat(sectionId).chat_id;
  const say = (chatId, senderId, content, at) =>
    db.prepare("INSERT INTO messages (chat_id, sender_id, content, sent_at) VALUES (?, ?, ?, ?)").run(chatId, senderId, content, at);

  say(channel(1), 2, "Has anyone started the Deliverable 3 prototype yet?", "2026-11-14 15:00:00");
  say(channel(1), 4, "Not yet, still figuring out the database.", "2026-11-14 15:04:00");
  say(channel(2), 7, "Is the presentation this Friday or the next?", "2026-11-13 18:20:00");

  const listing = (id, sectionId, title, description, limit, status) =>
    db.prepare(`INSERT INTO project_listings (listing_id, section_id, title, description, member_limit, status, created_date)
                VALUES (?, ?, ?, ?, ?, ?, '2026-11-15 14:00:00')`).run(id, sectionId, title, description, limit, status);
  const member = (listingId, studentId, role) =>
    db.prepare("INSERT INTO team_memberships (listing_id, student_id, role, joined_date) VALUES (?, ?, ?, '2026-11-15 14:00:00')")
      .run(listingId, studentId, role);
  const request = (listingId, studentId, message, status) =>
    db.prepare(`INSERT INTO join_requests (listing_id, student_id, message, status, request_date, decided_date)
                VALUES (?, ?, ?, ?, '2026-11-15 14:30:00', ?)`)
      .run(listingId, studentId, message, status, status === "Pending" ? null : "2026-11-15 15:00:00");

  // Ping 1: Madison's ITEC 4010 team, 2 of 4 seats. Chloe and Noah are Pending.
  // Noah requested before he dropped the course, so approving him is refused
  listing(1, 1, "Term project team (need 2 more)",
    "Building a student app for the term project. Looking for someone comfortable with UML and someone who likes front-end work.", 4, "Open");
  member(1, 1, "Creator");
  member(1, 2, "Member");
  request(1, 2, "I can do the diagrams.", "Approved");
  request(1, 3, "Happy to take the front end!", "Pending");
  request(1, 7, "Interested if there's still room!", "Pending");
  say(channel(1), null, 'Madison Cross posted a Project Ping: "Term project team (need 2 more)" (team of 4).', "2026-11-15 14:00:00");

  // Ping 2: Aston's ITEC 3505 partner search, 1 of 2 seats
  listing(2, 2, "Case Study #2 Assignment",
    "Looking for one partner for the case study assignment. I can meet on campus most weekdays after 4.", 2, "Open");
  member(2, 4, "Creator");
  // Two pending requests, so the creator board can show a team filling up: approving one makes the
  // Ping Full, declines the other, and creates the team chat 
  request(2, 2, "I'd be happy to team up with you", "Pending");
  request(2, 8, "I'm free weekdays after 5 if that works!", "Pending");
  say(channel(2), null, 'Aston Barnes posted a Project Ping: "Case Study #2 Assignment" (team of 2).', "2026-11-15 14:00:00");

  // Ping 3: Chloe's ITEC 4030 study group, already Full, with its team chat
  listing(3, 3, "Weekly lab study group", "Weekly review of the lab exercises before each quiz.", 3, "Full");
  member(3, 3, "Creator");
  member(3, 6, "Member");
  member(3, 8, "Member");
  request(3, 6, "", "Approved");
  request(3, 8, "", "Approved");
  const teamChat = ChatRepository.saveChat({ chatType: "TeamChat", name: "Weekly lab study group", listingId: 3 });
  ChatRepository.addMember(teamChat, 3, "Owner");
  ChatRepository.addMember(teamChat, 6);
  ChatRepository.addMember(teamChat, 8);
  say(teamChat, null, "Team chat created. Say hi to your team!", "2026-11-15 15:00:00");
  say(teamChat, 3, "Hi both! Does the Scott Library study room on thursday at 4 work for you guys?", "2026-11-15 15:05:00");
  say(teamChat, 6, "Yeah that should be fine for me.", "2026-11-15 15:07:00");
});

console.log(`Seeded ${students.length} students, ${sections.length} sections, 3 Project Pings and their chats into ${DB_PATH}`);
