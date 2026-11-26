/* <<controller>> ProjectRequestController (Deliverable 2 Diagram 1 and the interaction model).
   Coordinates the Project Ping scenario. The rules live in the ProjectListing and JoinRequest
   entities, and chat creation is passed to ChatController (Deliverable 2 Design Decision 1). */
const { transaction } = require("../db");
const repo = require("../repositories/ProjectRepository");
const chats = require("../repositories/ChatRepository");
const enrollment = require("../repositories/EnrollmentGateway");
const ProjectListing = require("../entities/ProjectListing");
const JoinRequest = require("../entities/JoinRequest");
const ChatController = require("./ChatController");
const { refuse, forbid } = require("../services/errors");
const { notify, notifyMany } = require("../services/notifier");

const ProjectRequestController = {

  processDecision(student, requestId, decision) {
    ChatController.requireConduct(student.student_id);
    const request = JoinRequest.find(requestId);
    const listing = ProjectListing.find(request.listing_id);
    if (!listing.isCreator(student.student_id)) throw forbid("Only the creator of this Project Ping can do that", "BR-x");

    if (decision === "decline") {
      return transaction(() => {
        request.declineRequest();
        notify(request.student_id, `Your request to join "${listing.title}" was declined.`, "/requests.html"); // notifyStudent
        return { status: "Declined", becameFull: false };
      });
    }
    if (decision !== "approve") throw refuse("Decision must be approve or decline", "FR-15");

    // Re-check what could have changed since the request was sent
    if (request.status !== "Pending") throw refuse(`Only Pending requests can be approved (this one is ${request.status})`, "BR-x");
    if (listing.status !== "Open") throw refuse(`The Project Ping is ${listing.status}, so no more students can be approved`, "BR-x");
    if (!enrollment.isEnrolled(request.student_id, listing.section_id)) {
      throw refuse("That student is no longer enrolled in this section. Decline the request instead.", "BR-x");
    }
    const otherTeam = repo.activeTeamInSection(request.student_id, listing.section_id);
    if (otherTeam) throw refuse(`That student already joined another team in this section ("${otherTeam.title}")`, "BR-x");

    return transaction(() => {
      const name = repo.studentName(request.student_id);
      const full = listing.addMember(request.student_id); // full = addMember(studentId)
      request.approveRequest();                           // status = approveRequest()
      notify(request.student_id, `You were approved to join "${listing.title}".`, `/teams.html?listing=${listing.listing_id}`);

      // Their other pending requests in this section are withdrawn
      for (const other of repo.pendingRequestsInSection(request.student_id, listing.section_id, listing.listing_id)) {
        new JoinRequest(other).withdraw();
        notify(repo.creatorId(other.listing_id), `${name}'s request was withdrawn because they joined another team.`, `/mypings.html?listing=${other.listing_id}`);
      }
      // A seat was refilled after someone left, so the team chat already exists
      const existingChat = chats.findTeamChat(listing.listing_id);
      if (existingChat) ChatController.addToTeamChat(existingChat.chat_id, request.student_id, name);
      if (!full) return { status: "Approved", becameFull: false };

      // [team now full] closeListing(); getMemberIds(); createTeamChat(listingId, memberIds)
      listing.closeListing();
      for (const pending of repo.pendingRequests(listing.listing_id)) {
        new JoinRequest(pending).declineRequest();
        notify(pending.student_id, `"${listing.title}" is now full, so your request was declined.`, "/requests.html");
      }
      const memberIds = listing.getMemberIds();
      const chatId = existingChat ? existingChat.chat_id
        : ChatController.createTeamChat(listing.listing_id, memberIds, listing.title, listing.creatorId());
      notifyMany(memberIds, `Your team "${listing.title}" is full. The team chat is open.`, `/teams.html?listing=${listing.listing_id}`); // notifyTeamChatCreated
      return { status: "Approved", becameFull: true, chatId };
    });
  },

  // Everything the creator's request board shows
  board(student, listingId) {
    const listing = ProjectListing.find(listingId);
    if (!listing.isCreator(student.student_id)) throw forbid("Only the creator of this Project Ping can do that", "BR-x");
    const section = enrollment.findSection(listing.section_id);
    return {
      listing: { ...listing, course_code: section.course_code, section_code: section.section_code, seats_taken: listing.seatsTaken() },
      members: repo.activeMembers(listing.listing_id),
      requests: repo.requestsFor(listing.listing_id).map((r) => ({ ...r, still_enrolled: enrollment.isEnrolled(r.student_id, listing.section_id) }))
    };
  }
};

module.exports = ProjectRequestController;
