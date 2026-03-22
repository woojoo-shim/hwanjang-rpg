/** @type {import("partykit/server").default} */
export default {
  options: { hibernate: true },

  onConnect(conn, room) {
    var players = {};
    for (var c of room.getConnections()) {
      if (c.id === conn.id) continue;
      var st = c.deserializeAttachment();
      if (st) players[st.uid || c.id] = st;
    }
    conn.send(JSON.stringify({ type: 'init', players: players }));
  },

  onMessage(msg, conn, room) {
    var data = JSON.parse(msg);

    if (data.type === 'join') {
      var uid = data.uid || conn.id;
      var state = { uid: uid, name: data.name, level: data.level, x: data.x, z: data.z, ry: data.ry };

      for (var c of room.getConnections()) {
        if (c.id === conn.id) continue;
        var oldSt = c.deserializeAttachment();
        if (oldSt && oldSt.uid === uid) {
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
  },

  onClose(conn, room) {
    var st = conn.deserializeAttachment();
    var uid = st ? (st.uid || conn.id) : conn.id;
    room.broadcast(JSON.stringify({ type: 'leave', id: uid }));
  }
};
