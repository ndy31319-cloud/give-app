const test = require("node:test");
const assert = require("node:assert/strict");

const {
  enrichPolicyLinks,
  isPolicySpecificUrl,
  normalizeUrl,
  resolvePolicyLinks,
} = require("../lib/policyLinks");

test("keeps a policy's own official detail URL", () => {
  const [policy] = enrichPolicyLinks(
    [{ policy_id: 1, policy_name: "긴급복지 생계지원", agency: "보건복지부", official_url: "http://gov.kr/portal/rcvfvrSvc/dtlEx/135200005003" }],
    [],
  );
  assert.equal(policy.official_url, "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/135200005003");
});

test("fills a legacy category row from an exact synchronized policy name", () => {
  const [policy] = enrichPolicyLinks(
    [{ policy_id: 3, policy_name: "아동수당", agency: "보건복지부", official_url: null }],
    [{ policy_id: 9, policy_name: "아동수당", agency: "보건복지부", official_url: "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/135200000120" }],
  );
  assert.equal(policy.official_url, "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/135200000120");
});

test("fills a conservative qualified-title match only for the same agency", () => {
  const [matched, rejected] = enrichPolicyLinks(
    [
      { policy_id: 1, policy_name: "청년내일저축계좌", agency: "보건복지부", official_url: null },
      { policy_id: 2, policy_name: "청년내일저축계좌", agency: "고용노동부", official_url: null },
    ],
    [{ policy_id: 900, policy_name: "자산형성지원사업(청년내일저축계좌)", agency: "보건복지부", official_url: "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/135200005013" }],
  );
  assert.equal(matched.official_url, "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/135200005013");
  assert.equal(rejected.official_url, null);
});

test("does not copy generic Government24 directories", () => {
  const [policy] = enrichPolicyLinks(
    [{ policy_id: 1, policy_name: "정책", agency: "기관", official_url: "https://www.gov.kr/portal/gvrnPolicy/listAll" }],
    [{ policy_id: 2, policy_name: "정책", agency: "기관", official_url: "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/1" }],
  );
  assert.equal(policy.official_url, "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/1");
  assert.equal(isPolicySpecificUrl("https://www.gov.kr/portal/gvrnPolicy/listAll"), false);
  assert.equal(normalizeUrl("http://gov.kr/portal/rcvfvrSvc/dtlEx/1"), "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/1");
});

test("removes a generic Government24 URL when no specific match exists", () => {
  const [policy] = enrichPolicyLinks(
    [{ policy_id: 1, policy_name: "정책", agency: "기관", official_url: "https://www.gov.kr/" }],
    [],
  );
  assert.equal(policy.official_url, null);
});

test("uses the verified legacy link for basic livelihood support", () => {
  const links = resolvePolicyLinks({ policy_name: "기초생활보장 생계급여", official_url: null, application_url: null });
  assert.equal(links.officialUrl, "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14600000275");
});
