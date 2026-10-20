#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [inputPath, outputPath] = process.argv.slice(2);
const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const systemPromptPath = resolve(scriptDirectory, "../system_prompt.txt");
const placeholder = "[SYSTEM_PROMPT: use the full text from ../system_prompt.txt]";

if (!inputPath || !outputPath) {
  console.error("Usage: node prepare_clova_dataset.mjs <template.csv> <output.csv>");
  process.exit(1);
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("닫히지 않은 큰따옴표가 있습니다.");
  if (cell.length || row.length) rows.push([...row, cell]);
  return rows.filter((row) => row.some((value) => value.trim()));
}

function encodeCsvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const template = readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const systemPrompt = readFileSync(systemPromptPath, "utf8")
  .replace(/\r?\n+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();
const rows = parseCsv(template);

if (!rows.length || rows[0].join(",") !== "System_Prompt,C_ID,T_ID,Text,Completion") {
  throw new Error("템플릿 헤더가 올바르지 않습니다.");
}

const preparedRows = rows.map((row, index) => {
  if (index === 0) return row;
  if (row[0] !== placeholder) {
    throw new Error(`${index + 1}행의 System_Prompt가 예상한 placeholder와 다릅니다.`);
  }
  return [systemPrompt, ...row.slice(1)];
});

const csv = preparedRows.map((row) => row.map(encodeCsvCell).join(",")).join("\n") + "\n";
writeFileSync(outputPath, `\uFEFF${csv}`, "utf8");
console.log(`Prepared ${preparedRows.length - 1} rows: ${outputPath}`);
