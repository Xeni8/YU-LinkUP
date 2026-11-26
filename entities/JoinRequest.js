/* <<entity>> JoinRequest (Deliverable 2 Diagram 1). Status: Pending -> Approved | Declined | Withdrawn.
 (Only a Pending request can change, and the other three statuses are final) */
const repo = require("../repositories/ProjectRepository");
const { refuse, notFound } = require("../services/errors");

class JoinRequest {
  constructor(row) {
    Object.assign(this, row); // request_id, listing_id, student_id, message, request_date, status, decided_date
  }

  static find(requestId) {
    const row = repo.findRequest(requestId);
    if (!row) throw notFound("Request");
    return new JoinRequest(row);
  }

  #moveTo(newStatus) {
    if (this.status !== "Pending") throw refuse(`Only Pending requests can change (this one is ${this.status})`, "BR-x");
    this.status = newStatus;
    repo.saveRequest(this);
    return newStatus;
  }

  approveRequest() { return this.#moveTo("Approved"); } // approveRequest(): RequestStatus
  declineRequest() { return this.#moveTo("Declined"); } // declineRequest(): RequestStatus
  withdraw() { return this.#moveTo("Withdrawn"); }      
}

module.exports = JoinRequest;
