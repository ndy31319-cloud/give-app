const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/chatText.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, URL };
vm.runInNewContext(compiled, context);

const cases = [
  {
    input: '홈페이지(https://www.energyv.or.kr/)에서도 확인 가능합니다.',
    expected: [
      { text: '홈페이지(' },
      { text: 'https://www.energyv.or.kr/', target: 'https://www.energyv.or.kr/' },
      { text: ')에서도 확인 가능합니다.' },
    ],
  },
  {
    input: 'https://example.com/에서 신청하세요.',
    expected: [
      { text: 'https://example.com/', target: 'https://example.com/' },
      { text: '에서 신청하세요.' },
    ],
  },
  {
    input: '자세한 내용은 www.example.kr/a?x=1&y=2, 참고하세요.',
    expected: [
      { text: '자세한 내용은 ' },
      { text: 'www.example.kr/a?x=1&y=2', target: 'https://www.example.kr/a?x=1&y=2' },
      { text: ',' },
      { text: ' 참고하세요.' },
    ],
  },
  {
    input: '[신청 페이지](https://example.com/%EA%B2%BD%EB%A1%9C)를 확인하세요.',
    expected: [
      { text: '신청 페이지 ↗', target: 'https://example.com/%EA%B2%BD%EB%A1%9C' },
      { text: '를 확인하세요.' },
    ],
  },
];

for (const { input, expected } of cases) {
  const actual = JSON.parse(JSON.stringify(context.exports.splitChatbotLinks(input)));
  assert.deepEqual(actual, expected, input);
}
console.log(`Passed ${cases.length} chatbot link cases.`);
