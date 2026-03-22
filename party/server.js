/** @type {import("partykit/server").default} */
export default {
  onConnect(conn, room) {
    if (!room._monsterHp) room._monsterHp = {};
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
      /* 같은 uid의 이전 연결 조용히 제거 (leave 안 보냄) */
      for (var c of room.getConnections()) {
        if (c.id === conn.id) continue;
        var oldSt = c.deserializeAttachment();
        if (oldSt && oldSt.uid === uid) {
          c.serializeAttachment(null);
          c.close(4000, 'dup');
        }
      }
      conn.serializeAttachment(state);
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
