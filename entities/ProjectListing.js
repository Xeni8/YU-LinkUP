/* <<entity>> ProjectListing (Deliverable 2 Diagram 1).
   Deliverable 2 Design Decision 1: the listing owns its eligibility check and roster, so these rules live here.
   Methods from the class diagram: checkEligibility, addMember, closeListing, getMemberIds. */
const repo = require("../repositories/ProjectRepository");
const { refuse, notFound } = require("../services/errors");

class ProjectListing {
  constructor(row) {
    Object.assign(this, row); // listing_id, section_id, title, description, member_limit, status, created_date
  }

  static find(listingId) {
    const row = repo.findListing(listingId);
    if (!row) throw notFound("Project Ping");
    return new ProjectListing(row);
  }

  getMemberIds() { return repo.activeMembers(this.listing_id).map((m) => m.student_id); }
  seatsTaken() { return repo.activeMembers(this.listing_id).length; }
  creatorId() { return repo.creatorId(this.listing_id); }
  isCreator(studentId) { return this.creatorId() === studentId; }

  // addMember(studentId): boolean. True when this member fills the last seat
  addMember(studentId) {
    if (this.seatsTaken() >= this.member_limit) throw refuse("The team is already full", "BR-x");
    repo.addMembership(this.listing_id, studentId, "Member");
    return this.seatsTaken() >= this.member_limit;
  }

  // closeListing(): the team is full, so it stops taking requests (sequence diagram: closed = closeListing())
  closeListing() {
    this.status = "Full";
    repo.saveListing(this);
  }
}

module.exports = ProjectListing;
