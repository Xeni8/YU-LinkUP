/* Database: tables follow Deliverable 2 domain model
   Uses Node's built-in SQLite (node:sqlite), so no npm install. */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./config");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

// CHECK constraints hold fixed value sets from Deliverable 2 "Attributes with specific possible values"
const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  student_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS code_of_conduct (
  version TEXT PRIMARY KEY,
  published_date TEXT NOT NULL,
  rules TEXT NOT NULL                       -- JSON list of rules shown to students
);
CREATE TABLE IF NOT EXISTS conduct_acceptances (   -- association class Student - CodeOfConduct
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  version TEXT NOT NULL REFERENCES code_of_conduct(version),
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, version)
);
CREATE TABLE IF NOT EXISTS course_sections (
  section_id INTEGER PRIMARY KEY,
  course_code TEXT NOT NULL,
  section_code TEXT NOT NULL,
  title TEXT NOT NULL,
  term TEXT NOT NULL,
  max_group_size INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (            -- association class Student - CourseSection
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  section_id INTEGER NOT NULL REFERENCES course_sections(section_id),
  enrolled_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Enrolled', 'Dropped')),
  PRIMARY KEY (student_id, section_id)
);
CREATE TABLE IF NOT EXISTS project_listings (
  listing_id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES course_sections(section_id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  member_limit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Full', 'Closed', 'Cancelled')),
  created_date TEXT NOT NULL DEFAULT (datetime('now'))
);
-- association class Student - ProjectListing. 
CREATE TABLE IF NOT EXISTS team_memberships (
  membership_id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES project_listings(listing_id),
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  joined_date TEXT NOT NULL DEFAULT (datetime('now')),
  left_date TEXT,
  role TEXT NOT NULL CHECK (role IN ('Creator', 'Member')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Left'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_membership
  ON team_memberships (listing_id, student_id) WHERE status = 'Active';
CREATE TABLE IF NOT EXISTS join_requests (
  request_id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES project_listings(listing_id),
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  message TEXT NOT NULL DEFAULT '',
  request_date TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Declined', 'Withdrawn')),
  decided_date TEXT
);
-- One Pending request per student per listing
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_request
  ON join_requests (listing_id, student_id) WHERE status = 'Pending';
-- Abstract Chat with subtypes, stored as 1 table with a chat_type column
CREATE TABLE IF NOT EXISTS chats (
  chat_id INTEGER PRIMARY KEY,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('CourseChat', 'TeamChat')),
  name TEXT NOT NULL,
  created_date TEXT NOT NULL DEFAULT (datetime('now')),
  read_only INTEGER NOT NULL DEFAULT 0,
  section_id INTEGER UNIQUE REFERENCES course_sections(section_id),
  listing_id INTEGER UNIQUE REFERENCES project_listings(listing_id)
);
CREATE TABLE IF NOT EXISTS chat_memberships (       -- association class Student - Chat
  chat_id INTEGER NOT NULL REFERENCES chats(chat_id),
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  joined_date TEXT NOT NULL DEFAULT (datetime('now')),
  role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Owner', 'Member')),
  PRIMARY KEY (chat_id, student_id)
);
CREATE TABLE IF NOT EXISTS messages (
  message_id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(chat_id),
  sender_id INTEGER REFERENCES students(student_id),   -- NULL = system message
  content TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);
-- Stores what ProjectBoardView's notifyHost / notifyStudent / notifyTeamChatCreated show
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  text TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function createSchema() {
  db.exec(SCHEMA);
}

/* Runs fn as one transaction, so every change succeeds together or none happen*/
let depth = 0;
function transaction(fn) {
  if (depth > 0) return fn();
  depth++;
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    depth--;
  }
}

module.exports = { db, createSchema, transaction };
