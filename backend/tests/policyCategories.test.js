const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalPolicyCategory,
  getPolicyCategoryAliases,
} = require("../lib/policyCategories");

test("maps detailed Government24 categories to the app category groups", () => {
  assert.equal(canonicalPolicyCategory("생활안정"), "생활비");
  assert.equal(canonicalPolicyCategory("보건·의료"), "의료");
  assert.equal(canonicalPolicyCategory("주거·자립"), "주거");
});

test("returns all database aliases for a selected app category", () => {
  assert.deepEqual(getPolicyCategoryAliases("교육"), ["교육", "보육·교육"]);
});
