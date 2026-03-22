/** @type {import("partykit/server").default} */
export default {
  options: { hibernate: true },

  onConnect(conn, room) {
    // 현재 접속 중인 플레이어 목록 전송
    var players = {};
    for (var c of room.getConnections()) {
      if (c.id === conn.id) continue;
      var st = c.deserializeAttachment();
      if (st) players[st.uid || c.id] = st;
    }
    conn.send(JSON.stringify({ type: 'init', players: players }));

    // 몬스터 상태 전송
    if (!room.monsterState) room.monsterState = {};
    conn.send(JSON.stringify({ type: 'monster_init', monsters: room.monsterState }));
  },

  onMessage(msg, conn, room) {
    var data = JSON.parse(msg);
    if (!room.monsterState) room.monsterState = {};

    if (data.type === 'join') {
      var uid = data.uid || conn.id;
      var state = { uid: uid, name: data.name, level: data.level, x: data.x, z: data.z, ry: data.ry };

      /* 같은 uid의 이전 연결 찾아서 킥 */
      for (var c of room.getConnections()) {
        if (c.id === conn.id) continue;
        var oldSt = c.deserializeAttachment();
        if (oldSt && oldSt.uid === uid) {
          room.broadcast(JSON.stringify({ type: 'leave', id: uid }), [conn.id]);
          c.close();
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

    /* ── 몬스터 동기화 ── */

    /* 클라이언트가 몬스터 스폰 목록 등록 (첫 접속자가 보냄) */
    if (data.type === 'monster_register') {
      /* 서버에 아직 몬스터가 없을 때만 등록 */
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

    /* 몬스터에게 데미지 */
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

    /* 몬스터 위치 업데이트 (AI 이동 — 호스트만 보냄) */
    if (data.type === 'monster_move') {
      var mm = room.monsterState[data.mid];
      if (mm) {
        mm.x = data.x;
        mm.z = data.z;
      }
      room.broadcast(JSON.stringify({
        type: 'monster_move', mid: data.mid, x: data.x, z: data.z
      }), [conn.id]);
    }
  },

  onClose(conn, room) {
    var st = conn.deserializeAttachment();
    var uid = st ? (st.uid || conn.id) : conn.id;
    room.broadcast(JSON.stringify({ type: 'leave', id: uid }));
  },

  /* 몬스터 리스폰 체크 (매 10초) */
  onAlarm(room) {
    if (!room.monsterState) return;
    var now = Date.now();
    var respawned = [];
    for (var mid in room.monsterState) {
      var mm = room.monsterState[mid];
      if (!mm.alive && mm.respawnAt && now >= mm.respawnAt) {
        mm.alive = true;
        mm.hp = mm.maxHp;
        delete mm.respawnAt;
        respawned.push(mm);
      }
    }
    if (respawned.length > 0) {
      room.broadcast(JSON.stringify({
        type: 'monster_respawn', list: respawned
      }));
    }
    room.storage.setAlarm(Date.now() + 10000);
  },

  async onStart(room) {
    room.monsterState = {};
    await room.storage.setAlarm(Date.now() + 10000);
  }
};
