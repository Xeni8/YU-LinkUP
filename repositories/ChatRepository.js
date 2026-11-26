/* <<interface>> ChatRepository (Deliverable 2 Diagram 3): findCourseChat, saveChat and chat memberships.
  Currently only what login, seed.js and processDecision need. */
const { db } = require("../db");

const one = (sql, ...args) => db.prepare(sql).get(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);

const ChatRepository = {
  findCourseChat: (sectionId) => one("SELECT * FROM chats WHERE chat_type = 'CourseChat' AND section_id = ?", sectionId),
  findTeamChat: (listingId) => one("SELECT * FROM chats WHERE chat_type = 'TeamChat' AND listing_id = ?", listingId),

  // saveChat(chat): creates a chat and returns its id
  saveChat: ({ chatType, name, sectionId = null, listingId = null }) => Number(run(
    "INSERT INTO chats (chat_type, name, section_id, listing_id) VALUES (?, ?, ?, ?)", chatType, name, sectionId, listingId).lastInsertRowid),

  // Chat Membership
  addMember: (chatId, studentId, role = "Member") =>
    run("INSERT OR IGNORE INTO chat_memberships (chat_id, student_id, role) VALUES (?, ?, ?)", chatId, studentId, role),
  removeMember: (chatId, studentId) => run("DELETE FROM chat_memberships WHERE chat_id = ? AND student_id = ?", chatId, studentId)
};

module.exports = ChatRepository; 