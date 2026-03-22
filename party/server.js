/** @type {import("partykit/server").default} */
export default {
  onConnect(conn, room) {
    if (!room.monsterState) room.monsterState = {};

    // 현재 접속 중인 플레이어 목록 전송
    var players = {};
    for (var c of room.getConnections()) {
      if (c.id === conn.id) continue;
      var st = c.deserializeAttachment();
      if (st) players[st.uid || c.id] = st;
    }
    conn.send(JSON.stringify({ type: 'init', players: players }));

    // 몬스터 상태 전송
    conn.send(JSON.stringify({ type: 'monster_init', monsters: room.monsterState }));
  },

  onMessage(msg, conn, room) {
    var data = JSON.parse(msg);
    if (!room.monsterState) room.monsterState = {};

    if (data.type === 'join') {
      var uid = data.uid || conn.id;
      var state = { uid: uid, name: data.name, level: data.level, x: data.x, z: data.z, ry: data.ry };

      for (var c of room.getConnections()) {
        if (c.id === conn.id) continue;
        var oldSt = c.deserializeAttachment();
        if (oldSt && oldSt.uid === uid) {
          room.broadcast(JSON.stringify({ type: 'leave', id: uid }), [conn.id]);
          c.close(4000, 'duplicate');
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

    if (data.type === 'monster_register') {
      if (Object.keys(room.monsterState).length === 0 && data.list) {
        for (var i = 0; i < data.list.length; i++) {
          var m = data.list[i];
          room.monsterState[m.mid] = {
            mid: m.mid, defId: m.defId,
            x: m.x, z: m.z,
            hp: m.hp, maxHp: m.maxHp,
            alive: true
          };
        }
      }
    }

    if (data.type === 'monster_hit') {
      var mm = room.monsterState[data.mid];
      if (mm && mm.alive) {
        mm.hp -= data.dmg;
        if (mm.hp <= 0) {
          mm.hp = 0;
          mm.alive = false;
          mm.respawnAt = Date.now() + (data.respawnMs || 30000);
        }
        room.broadcast(JSON.stringify({
          type: 'monster_update',
          mid: mm.mid, hp: mm.hp, alive: mm.alive,
          killerUid: data.uid || null
        }));
      }
    }

    if (data.type === 'monster_move') {
      var mm = room.monsterState[data.mid];
      if (mm) { mm.x = data.x; mm.z = data.z; }
      room.broadcast(JSON.stringify({
        type: 'monster_move', mid: data.mid, x: data.x, z: data.z
      }), [conn.id]);
    }

    if (data.type === 'monster_move_batch') {
      if (data.list) {
        for (var i = 0; i < data.list.length; i++) {
          var item = data.list[i];
          var mm = room.monsterState[item.mid];
          if (mm) { mm.x = item.x; mm.z = item.z; }
        }
        room.broadcast(JSON.stringify({
          type: 'monster_move_batch', list: data.list
        }), [conn.id]);
      }
    }
  },

  onClose(conn, room) {
    var st = conn.deserializeAttachment();
    var uid = st ? (st.uid || conn.id) : conn.id;
    room.broadcast(JSON.stringify({ type: 'leave', id: uid }));
  }
};
