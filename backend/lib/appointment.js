const { fail } = require('./tradeState');
function readAppointment(value) {
  return value ? (typeof value === 'string' ? JSON.parse(value) : value) : { revision: 0, confirmed: null, pending: null };
}
function transition(current, action, input, memberId) {
  if (!Number.isSafeInteger(input?.revision) || input.revision !== current.revision) fail(409, '약속 정보가 변경됐어요. 최신 내용을 확인한 뒤 다시 시도해주세요.');
  if (action === 'confirm') {
    if (!current.pending) fail(409, '확정할 제안이 없습니다.');
    if (current.pending.proposedBy === String(memberId)) fail(403, '상대방이 약속을 확인해야 합니다.');
    if (Date.parse(current.pending.at) <= Date.now()) fail(409, '이미 지난 시간입니다. 새 약속을 제안해주세요.');
    return { revision: current.revision + 1, confirmed: current.pending, pending: null };
  }
  const at = typeof input.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(input.at) ? Date.parse(input.at) : NaN;
  const place = typeof input.place === 'string' ? input.place.trim() : '';
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0,19) !== input.at.slice(0,19) || at <= Date.now()) fail(400, '미래의 올바른 약속 시간을 입력해주세요.');
  if (!place || place.length > 200) fail(400, '장소를 1~200자로 입력해주세요.');
  const { latitude = null, longitude = null } = input;
  if ((latitude !== null || longitude !== null) &&
    (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) fail(400, '올바른 위치 좌표가 필요합니다.');
  return { ...current, revision: current.revision + 1, pending: { at: new Date(at).toISOString(), place, latitude, longitude, proposedBy: String(memberId) } };
}
module.exports = { readAppointment, transition };
