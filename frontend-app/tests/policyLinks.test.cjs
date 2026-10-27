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

console.log('Passed Government24 policy URL normalization cases.');
