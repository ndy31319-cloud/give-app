const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/policyLinks.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, URL, Set };
vm.runInNewContext(compiled, context);

assert.equal(
  context.exports.normalizePolicyUrl('http://www.gov.kr/portal/rcvfvrSvc/dtlEx/123?x=1'),
  'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/123?x=1',
);
assert.equal(
  context.exports.normalizePolicyUrl('http://gov.kr/portal/rcvfvrSvc/dtlEx/456'),
  'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/456',
);
assert.equal(
  context.exports.normalizePolicyUrl('http://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/move TW01000M01.do'),
  'http://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/move%20TW01000M01.do',
);
assert.equal(context.exports.normalizePolicyUrl('not-a-url'), null);
assert.equal(context.exports.normalizePolicyUrl(''), null);
assert.equal(
  context.exports.buildPolicySearchUrl('기초생활보장 생계급여'),
  'https://www.gov.kr/search?srchTxt=%EA%B8%B0%EC%B4%88%EC%83%9D%ED%99%9C%EB%B3%B4%EC%9E%A5%20%EC%83%9D%EA%B3%84%EA%B8%89%EC%97%AC',
);
assert.equal(
  context.exports.resolvePolicyUrl(null, null, '청년 주거 지원'),
  'https://www.gov.kr/search?srchTxt=%EC%B2%AD%EB%85%84%20%EC%A3%BC%EA%B1%B0%20%EC%A7%80%EC%9B%90',
);
assert.equal(
  context.exports.resolvePolicyUrl('https://www.gov.kr/portal/rcvfvrSvc/dtlEx/1', null, '정책'),
  'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/1',
);

console.log('Passed Government24 policy URL normalization cases.');
