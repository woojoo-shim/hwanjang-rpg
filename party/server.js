/** @type {import("partykit/server").default} */
export default {
  onConnect(conn, room) {
    if (!room._monsterHp) room._monsterHp = {};
    if (!room._uidMap) room._uidMap = {};
    var players = {};
    for (var c of room.getConnections()) {
      if (c.id === conn.id) continue;
      var st = c.deserializeAttachment();
      if (st) players[st.uid || c.id] = st;
    }
    conn.send(JSON.stringify({ type: 'init', players: players }));
    if (room._monsterHp && Object.keys(room._monsterHp).length > 0) {
      conn.send(JSON.stringify({ type: 'mhp', hp: room._monsterHp }));
    }
    if (!room._hostId) {
      room._hostId = conn.id;
      conn.send('host');
    }
  },

  onMessage(msg, conn, room) {
    if (!room._monsterHp) room._monsterHp = {};
    if (typeof msg === 'string' && msg.indexOf('mp|') === 0) {
      room.broadcast(msg, [conn.id]);
      return;
    }
    var data = JSON.parse(msg);

    if (data.type === 'join') {
      var uid = data.uid || conn.id;
      var state = { uid: uid, name: data.name, level: data.level, x: data.x, z: data.z, ry: data.ry };
      conn.serializeAttachment(state);
      if (!room._uidMap) room._uidMap = {};
      room._uidMap[uid] = conn.id;
      room.broadcast(JSON.stringify({
        type: 'join', id: uid,
        name: data.name, level: data.level,
        x: data.x, z: data.z, ry: data.ry
      }), [conn.id]);
    }

    if (data.type === 'move') {
      var st = conn.deserializeAttachment();
      if (st) {
        st.x = data.x; st.z = data.z; st.ry = data.ry; conn.serializeAttachment(st);
        room.broadcast(JSON.stringify({
          type: 'move', id: st.uid || conn.id,
          x: data.x, z: data.z, ry: data.ry, moving: data.moving
        }), [conn.id]);
      }
    }

    if (data.type === 'chat') {
      room.broadcast(JSON.stringify({
        type: 'chat', id: conn.id, name: data.name, text: data.text
      }), [conn.id]);
    }

    if (data.type === 'attack') {
      var st = conn.deserializeAttachment();
      room.broadcast(JSON.stringify({
        type: 'attack', id: st ? (st.uid || conn.id) : conn.id
      }), [conn.id]);
    }

    /* ── 파티 메시지: 대상에게 직접 전달 ── */
    if (data.type === 'party_invite' || data.type === 'party_accept' || data.type === 'party_reject' || data.type === 'party_kick') {
      var st = conn.deserializeAttachment();
      var fromUid = st ? (st.uid || conn.id) : conn.id;
      var targetUid = data.target;
      if (!room._uidMap) room._uidMap = {};
      var targetConnId = room._uidMap[targetUid];
      /* connId로 직접 찾기 */
      for (var c of room.getConnections()) {
        if (c.id === targetConnId || (!targetConnId && (function(){ var cs=c.deserializeAttachment(); return cs&&(cs.uid||c.id)===targetUid; })())) {
          var fwd = JSON.parse(JSON.stringify(data));
          fwd.from = fromUid;
          c.send(JSON.stringify(fwd));
          break;
        }
      }
    }

    /* 파티 업데이트/탈퇴/HP/채팅: 같은 partyId 멤버 전체에게 */
    if (data.type === 'party_update' || data.type === 'party_leave' || data.type === 'party_hp' || data.type === 'party_chat') {
      var st = conn.deserializeAttachment();
      var fromUid = st ? (st.uid || conn.id) : conn.id;
      var fwd = JSON.parse(JSON.stringify(data));
      fwd.from = fromUid;
      room.broadcast(JSON.stringify(fwd), [conn.id]);
    }

    if (data.type === 'mdmg') {
      room.broadcast(JSON.stringify(data), [conn.id]);
    }

    if (data.type === 'mhit') {
      var mid = data.mid;
      if (room._monsterHp[mid] === undefined) room._monsterHp[mid] = data.maxHp;
      room._monsterHp[mid] = Math.max(0, room._monsterHp[mid] - data.dmg);
      var dead = room._monsterHp[mid] <= 0;
      room.broadcast(JSON.stringify({
        type: 'mhit', mid: mid, hp: room._monsterHp[mid], dead: dead
      }), [conn.id]);
      if (dead) {
        setTimeout(function() {
          room._monsterHp[mid] = data.maxHp;
          room.broadcast(JSON.stringify({ type: 'mrespawn', mid: mid, hp: data.maxHp }));
        }, 30000);
      }
    }
  },

  onClose(conn, room) {
    var st = conn.deserializeAttachment();
    if (!st) return;
    var uid = st.uid || conn.id;
    if (room._uidMap && room._uidMap[uid]) delete room._uidMap[uid];
    room.broadcast(JSON.stringify({ type: 'leave', id: uid }));
    if (room._hostId === conn.id) {
      room._hostId = null;
      for (var c of room.getConnections()) {
        if (c.id !== conn.id) {
          room._hostId = c.id;
          c.send('host');
          break;
        }
      }
    }
  }
};
