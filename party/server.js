/** @type {import("partykit/server").default} */
export default {
  options: { hibernate: true },

  onConnect(conn, room) {
    // 현재 접속 중인 플레이어 목록 전송
    var players = {};
    for (var c of room.getConnections()) {
      if (c.id === conn.id) continue;
      var st = c.deserializeAttachment();
      if (st) players[c.id] = st;
    }
    conn.send(JSON.stringify({ type: 'init', players: players }));
  },

  onMessage(msg, conn, room) {
    var data = JSON.parse(msg);

    if (data.type === 'join') {
      var state = { name: data.name, level: data.level, x: data.x, z: data.z, ry: data.ry };
      conn.serializeAttachment(state);
      room.broadcast(JSON.stringify({
        type: 'join', id: conn.id,
        name: data.name, level: data.level,
        x: data.x, z: data.z, ry: data.ry
      }), [conn.id]);
    }

    if (data.type === 'move') {
      var st = conn.deserializeAttachment();
      if (st) { st.x = data.x; st.z = data.z; st.ry = data.ry; conn.serializeAttachment(st); }
      room.broadcast(JSON.stringify({
        type: 'move', id: conn.id,
        x: data.x, z: data.z, ry: data.ry, moving: data.moving
      }), [conn.id]);
    }

    if (data.type === 'chat') {
      room.broadcast(JSON.stringify({
        type: 'chat', id: conn.id, name: data.name, text: data.text
      }), [conn.id]);
    }

    if (data.type === 'attack') {
      room.broadcast(JSON.stringify({
        type: 'attack', id: conn.id
      }), [conn.id]);
    }
  },

  onClose(conn, room) {
    room.broadcast(JSON.stringify({ type: 'leave', id: conn.id }));
  }
};
