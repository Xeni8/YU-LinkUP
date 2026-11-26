/* Rule was broken. `rule` names the requirement or business rule,
   so the page and the tests can show which rule stopped the action. */
class RuleError extends Error {
  constructor(status, message, rule, code) {
    super(message);
    this.status = status;
    this.rule = rule;
    this.code = code;
  }
}

const refuse = (message, rule) => new RuleError(400, message, rule);
const forbid = (message, rule) => new RuleError(403, message, rule);
const notFound = (what) => new RuleError(404, `${what} not found`);

module.exports = { RuleError, refuse, forbid, notFound };
