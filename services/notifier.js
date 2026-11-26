/* In-app notifications. They're what ProjectBoardView's notifyHost / notifyStudent / notifyTeamChatCreated show the student. */
const { db } = require("../db");

function notify(studentId, text, link = null) {
  db.prepare("INSERT INTO notifications (student_id, text, link) VALUES (?, ?, ?)").run(studentId, text, link);
}

function notifyMany(studentIds, text, link = null) {
  for (const id of studentIds) notify(id, text, link);
}

module.exports = { notify, notifyMany };
