/* <<controller>> EnrollmentController (Deliverable 2 Diagram 3).
   syncChatMemberships(studentId): adds the student to the class channel of every section they're enrolled in
   and removes them from sections they dropped. Runs at every login. */
const enrollment = require("../repositories/EnrollmentGateway");
const chats = require("../repositories/ChatRepository");
const ChatController = require("./ChatController");
const { transaction } = require("../db");

const EnrollmentController = {
  syncChatMemberships(studentId) {
    transaction(() => {
      for (const section of enrollment.getActiveEnrollments(studentId)) {
        const chat = chats.findCourseChat(section.section_id);
        chats.addMember(chat ? chat.chat_id : ChatController.createCourseChat(section), studentId);
      }
      for (const sectionId of enrollment.getDroppedSections(studentId)) {
        const chat = chats.findCourseChat(sectionId);
        if (chat) chats.removeMember(chat.chat_id, studentId);
      }
    });
  }
};

module.exports = EnrollmentController;
