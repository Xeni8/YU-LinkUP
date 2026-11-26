/* <<controller>> ChatController (Deliverable 2 Diagram 1 and 3).*/
const chats = require("../repositories/ChatRepository");

const ChatController = {
  createCourseChat: (section) =>
    chats.saveChat({ chatType: "CourseChat", name: `${section.course_code} ${section.section_code}`, sectionId: section.section_id }),

  // Note: Placeholder for now(lets every student through until code of conduct is implemented)
  requireConduct(studentId) {},
  hasAcceptedCurrent: (studentId) => true,

  createTeamChat(listingId, memberIds, name, creatorId) {
    return chats.saveChat({ chatType: "TeamChat", name, listingId });
  },

  addToTeamChat(chatId, studentId, name) {}
};

module.exports = ChatController;
