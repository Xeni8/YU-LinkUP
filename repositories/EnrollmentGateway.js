/* <<interface>> EnrollmentGateway (Deliverable 2 Diagram 3).
   Real system would call York's enrollement system but protoype just reads mock data*/
const { db } = require("../db");

const EnrollmentGateway = {
  
  // getActiveEnrollments(studentId): List<Enrollment>
  getActiveEnrollments: (studentId) => db.prepare(`
    SELECT s.* FROM enrollments e JOIN course_sections s ON s.section_id = e.section_id
    WHERE e.student_id = ? AND e.status = 'Enrolled' ORDER BY s.course_code, s.section_code`).all(studentId),
  getDroppedSections: (studentId) =>
    db.prepare("SELECT section_id FROM enrollments WHERE student_id = ? AND status = 'Dropped'").all(studentId).map((r) => r.section_id),

  isEnrolled: (studentId, sectionId) =>
    !!db.prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND section_id = ? AND status = 'Enrolled'").get(studentId, sectionId),
  getEnrolledStudentIds: (sectionId) =>
    db.prepare("SELECT student_id FROM enrollments WHERE section_id = ? AND status = 'Enrolled'").all(sectionId).map((r) => r.student_id),
  findSection: (sectionId) => db.prepare("SELECT * FROM course_sections WHERE section_id = ?").get(sectionId)
};

module.exports = EnrollmentGateway;
