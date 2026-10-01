const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/chatText.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../../ai-server/tests/chat_text_cases.json'), 'utf8'));
for (const [input, expected] of cases) {
  assert.equal(context.exports.normalizeChatbotText(input), expected, input);
}
console.log(`Passed ${cases.length} chatbot text cases.`);
