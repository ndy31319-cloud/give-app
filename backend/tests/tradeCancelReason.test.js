const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateCancelReason } = require('../lib/tradeState');

function fixture() {
  const row = { pickup_id: 1, chat_room_id: 'trade_1', donate_id: 2, donor_id: 10, requester_id: 20,
    requester_name: '이웃', title: '책', request_status: 'approved', post_status: 'reserved',
    cancel_reason: null, chat_synced: true, requested_at: new Date(), appointment: null };
  let notices = 0;
  let writes = 0;
  let delivered;
  let offline = false;
  const query = async (sql, args = []) => {
    if (sql.startsWith('SELECT * FROM ITEM_DONATE')) return [[{donate_id: 2, member_id: 10, status: row.post_status}]];
    if (sql.startsWith('SELECT transfer_id, status FROM LOCKER_TRANSFER')) return [[]];
    if (sql.startsWith('SELECT p.') || sql.startsWith('SELECT * FROM PICKUP_REQUEST')) return [[{...row}]];
    if (sql.startsWith('SELECT member_id')) return [[{member_id:10}, {member_id:20}]];
    if (sql.startsWith('UPDATE PICKUP_REQUEST SET request_status')) {
      writes++;
      row.request_status = args[0];
      row.cancel_reason = args[5];
      row.chat_synced = false;
      return [{}];
    }
    if (sql.startsWith('UPDATE ITEM_DONATE')) { row.post_status = args[0]; return [{}]; }
    if (sql.startsWith('UPDATE PICKUP_REQUEST SET chat_synced')) { row.chat_synced = true; return [{}]; }
    if (sql.startsWith('INSERT INTO NOTIFICATION')) { notices++; return [{}]; }
    throw new Error('Unexpected query: ' + sql);
  };
  const connection = {query, async beginTransaction(){}, async commit(){}, async rollback(){}, release(){}};
  const room = {id:'trade_1', async get(){return {exists:true,data(){return {tradeRequestId:'1'};}};}, collection(){return {doc(){return {};}};}};
  const firestore = { collection(){return {doc(){return room;}};}, batch(){return {set(ref, value){delivered=value.tradeRequest;},async commit(){}};} };
  const dependencies = {
    '../db': {query, async getConnection(){return connection;}},
    '../lib/appointment': require('../lib/appointment'),
    '../lib/tradeState': require('../lib/tradeState'),
    '../lib/firebaseAdmin': {getFirestore(){if(offline)throw new Error('Offline');return firestore;}},
  };
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/trades.js'),'utf8'), {
    require(name){assert.ok(name in dependencies);return dependencies[name];}, module, Date,
    console:{error(){}},
  });
  return {trades:module.exports,row,counts:()=>({notices,writes}),delivered:()=>delivered,setOffline(value){offline=value;}};
}

test('cancel reason rejects blanks and invalid types; accepts 200 characters', () => {
  for(const value of [undefined,null,'',' \n ',123,{},'가'.repeat(201)]) {
    assert.throws(()=>validateCancelReason(value),e=>e.statusCode===400);
  }
  assert.equal(validateCancelReason('  일정이 맞지 않아요.  '),'일정이 맞지 않아요.');
  assert.equal(validateCancelReason('가'.repeat(200)).length,200);
});

test('missing reason or unauthorized participant leaves transaction unchanged', async () => {
  const f=fixture();
  await assert.rejects(f.trades.act('1','cancel',20,{reason:'  '}),e=>e.statusCode===400);
  await assert.rejects(f.trades.act('1','cancel',99,{reason:'사유'}),e=>e.statusCode===403);
  assert.equal(f.row.request_status,'approved');
  assert.deepEqual(f.counts(),{notices:0,writes:0});
});

test('reason is stored, returned and delivered to chat; retries preserve the first reason', async () => {
  const f=fixture();
  const result=await f.trades.act('1','cancel',20,{reason:'  시간이 맞지 않아요.  '});
  assert.equal(result.status,'canceled');
  assert.equal(result.postStatus,'open');
  assert.equal(result.cancelReason,'시간이 맞지 않아요.');
  assert.equal(f.row.cancel_reason,result.cancelReason);
  assert.equal(f.delivered().cancelReason,result.cancelReason);
  const repeat=await f.trades.act('1','cancel',10,{reason:'다른 사유'});
  assert.equal(repeat.cancelReason,result.cancelReason);
  assert.deepEqual(f.counts(),{notices:1,writes:1});
});

test('chat delivery failure retains the reason for a later retry', async () => {
  const f=fixture();
  f.setOffline(true);
  const result=await f.trades.act('1','cancel',10,{reason:'물품을 다시 확인해야 해요.'});
  assert.equal(result.cancelReason,'물품을 다시 확인해야 해요.');
  assert.equal(f.row.chat_synced,false);
  f.setOffline(false);
  await f.trades.sync('1');
  assert.equal(f.row.chat_synced,true);
  assert.equal(f.delivered().cancelReason,result.cancelReason);
});
