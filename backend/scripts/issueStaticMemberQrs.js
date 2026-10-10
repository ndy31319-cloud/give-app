const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');
const jsQR = require('jsqr');
const db = require('../db');

// GIVE_주소변경_회원목록_2026-10-10.xlsx: 기부자 10명, 수혜자 10명.
const targets = [
  [10, 1, '평촌동'], [11, 1, '안양동'], [12, 1, '박달동'],
  [14, 1, '안양동'], [15, 1, '박달동'], [16, 1, '비산동'],
  [17, 1, '평촌동'], [18, 1, '호계동'], [19, 1, '비산동'],
  [20, 1, '석수동'], [24, 3, '안양동'], [25, 3, '석수동'],
  [26, 3, '박달동'], [27, 3, '호계동'], [28, 3, '비산동'],
  [29, 3, '평촌동'], [30, 3, '안양동'], [31, 3, '박달동'],
  [32, 3, '호계동'], [33, 3, '비산동'],
];

const outputDir = path.join(__dirname, '..', '..', 'outputs',
  '01a10acb-b452-7cc1-bed0-6c9625fb2454', 'static-member-qr');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function loadAndCheckMembers(connection) {
  const ids = targets.map(([id]) => id);
  const [members] = await connection.query(
    'SELECT member_id, nickname, role_id, dong_name FROM MEMBER WHERE member_id IN (?)',
    [ids],
  );
  const byId = new Map(members.map((member) => [member.member_id, member]));
  for (const [id, roleId, dongName] of targets) {
    const member = byId.get(id);
    if (!member || member.role_id !== roleId || member.dong_name !== dongName) {
      throw new Error(`회원 ${id}의 존재 여부, 역할 또는 주소가 목록과 다릅니다.`);
    }
  }
  return members;
}

async function writeQrImages(members, tokens) {
  await fs.mkdir(outputDir, { recursive: true });
  const entries = [];
  for (const member of members.sort((a, b) => a.member_id - b.member_id)) {
    const token = tokens.get(member.member_id);
    const fileName = `member-${member.member_id}.png`;
    const filePath = path.join(outputDir, fileName);
    await QRCode.toFile(filePath, token, {
      errorCorrectionLevel: 'M', margin: 4, width: 512,
    });
    const { data, info } = await sharp(filePath).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (decoded?.data !== token) {
      throw new Error(`회원 ${member.member_id}의 QR 이미지 디코딩 검증에 실패했습니다.`);
    }
    entries.push({
      memberId: member.member_id,
      nickname: member.nickname,
      role: member.role_id === 1 ? '기부자' : '수혜자',
      fileName,
    });
  }

  await fs.writeFile(path.join(outputDir, 'manifest.json'),
    JSON.stringify(entries, null, 2), 'utf8');
  const cards = entries.map((entry) => `
    <article><img src="${entry.fileName}" alt="${escapeHtml(entry.nickname)} QR">
      <strong>${escapeHtml(entry.nickname)} · 회원 ${entry.memberId}</strong>
      <span>${entry.role}</span></article>`).join('');
  await fs.writeFile(path.join(outputDir, 'index.html'), `<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GIVE 회원별 정적 QR 테스트</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#17362c;background:#f5faf7}
h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}
article{background:white;padding:18px;border-radius:14px;display:grid;gap:8px;box-shadow:0 1px 8px #dae8df}
img{width:100%;image-rendering:pixelated}strong{font-size:17px}span,p{color:#50695d}</style>
<h1>GIVE 회원별 정적 QR 테스트</h1>
<p>기부자 10명과 수혜자 10명입니다. 스캔 인식 확인용이며 보관함 사용 권한은 거래 상태를 별도로 확인해야 합니다.</p>
<main class="grid">${cards}</main></html>`, 'utf8');
  return entries;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const connection = await db.getConnection();
  try {
    const members = await loadAndCheckMembers(connection);
    if (!apply) {
      console.log(`대상 확인: 기부자 10명, 수혜자 10명. 발급하려면 --apply를 사용하세요.`);
      return;
    }

    await connection.query(`CREATE TABLE IF NOT EXISTS MEMBER_QR (
      member_id INT NOT NULL PRIMARY KEY,
      token VARCHAR(96) NOT NULL UNIQUE,
      issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_member_qr_member FOREIGN KEY (member_id)
        REFERENCES MEMBER(member_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.beginTransaction();
    for (const member of members) {
      const [existing] = await connection.query(
        'SELECT token FROM MEMBER_QR WHERE member_id = ? FOR UPDATE',
        [member.member_id],
      );
      if (existing.length === 0) {
        const token = `give-member-v1:${crypto.randomBytes(32).toString('base64url')}`;
        await connection.query(
          'INSERT INTO MEMBER_QR (member_id, token) VALUES (?, ?)',
          [member.member_id, token],
        );
      }
    }
    await connection.commit();

    const [rows] = await connection.query(
      'SELECT member_id, token FROM MEMBER_QR WHERE member_id IN (?)',
      [targets.map(([id]) => id)],
    );
    const tokens = new Map(rows.map((row) => [row.member_id, row.token]));
    if (tokens.size !== targets.length) {
      throw new Error('20명 중 일부에게 QR이 발급되지 않았습니다.');
    }
    const entries = await writeQrImages(members, tokens);
    console.log(`${entries.length}명의 정적 QR을 확인하고 이미지를 생성했습니다: ${outputDir}`);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error('정적 QR 발급 실패:', error.message);
  process.exitCode = 1;
});
