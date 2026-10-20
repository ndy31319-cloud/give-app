#!/usr/bin/env node

import { readFileSync } from "node:fs";

const expectedHeader = ["System_Prompt", "C_ID", "T_ID", "Text", "Completion"];
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node validate_clova_dataset.mjs <dataset.csv>");
  process.exit(1);
}

const raw = readFileSync(filePath);
const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
const source = raw.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

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
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((row) => row.some((cell) => cell.trim().length));
}

let rows;
try {
  rows = parseCsv(source);
} catch (error) {
  console.error(`FAIL: CSV 파싱 오류 - ${error.message}`);
  process.exit(1);
}

const errors = [];
const [header, ...records] = rows;
if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
  errors.push(`헤더는 정확히 ${expectedHeader.join(",")} 순서여야 합니다.`);
}
if (!hasBom) errors.push("UTF-8 BOM이 없습니다. UTF-8 with BOM(UTF-8-SIG)으로 다시 저장하세요.");
if (!records.length) errors.push("학습 행이 없습니다.");

const seen = new Set();
records.forEach((record, index) => {
  const line = index + 2;
  if (record.length !== expectedHeader.length) {
    errors.push(`${line}행: 열 수가 ${expectedHeader.length}개가 아닙니다.`);
    return;
  }
  record.forEach((cell, cellIndex) => {
    if (!cell.trim()) errors.push(`${line}행: ${expectedHeader[cellIndex]} 값이 비어 있습니다.`);
  });
  const expectedId = index;
  if (Number(record[1]) !== expectedId) errors.push(`${line}행: C_ID는 ${expectedId}여야 합니다.`);
  if (Number(record[2]) !== expectedId) errors.push(`${line}행: T_ID는 ${expectedId}여야 합니다.`);
  const fingerprint = `${record[3].trim()}\u0000${record[4].trim()}`;
  if (seen.has(fingerprint)) errors.push(`${line}행: Text와 Completion이 이전 행과 중복됩니다.`);
  seen.add(fingerprint);
});

if (errors.length) {
  console.error(`FAIL: ${errors.length}개 문제를 찾았습니다.`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`PASS: ${records.length}개 행, 헤더/ID/UTF-8 BOM/중복 검사를 통과했습니다.`);
