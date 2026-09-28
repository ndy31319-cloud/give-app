function invalid(message) {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

function parseMessage(body) {
  const type = body.type || body.messageType || body.message_type || 'TEXT';
  if (type === 'TEXT') {
    const text = String(body.text ?? body.content ?? '').trim();
    if (!text || text.length > 10000) invalid('메시지는 1~10,000자로 입력해주세요.');
    return { type, text };
  }
  if (type === 'LOCATION') {
    const { latitude, longitude, label } = body.location || {};
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      invalid('올바른 위치 좌표가 필요합니다.');
    }
    const place = typeof label === 'string' ? label.trim().slice(0, 200) : '';
    return { type, text: '현재 위치를 공유했어요.', location: { latitude, longitude, label: place || '공유한 위치' } };
  }
  invalid('지원하지 않는 메시지 형식입니다.');
}

function imageFormat(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['png', 'image/png'];
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return ['gif', 'image/gif'];
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
  invalid('JPG, PNG, GIF, WebP 사진을 선택해주세요.');
}

module.exports = { parseMessage, imageFormat };
