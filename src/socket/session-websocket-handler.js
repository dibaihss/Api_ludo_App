const toFirstNonEmptyUsername = (payload) => {
  const candidates = [payload.sender, payload.username, payload.name];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const emitTopic = (io, topic, payload) => {
  io.emit(topic, payload);
};

const registerSessionWebsocketHandlers = (io, socket) => {
  const chatSendMessage = (payload) => emitTopic(io, '/topic/public', payload);
  socket.on('/app/chat.sendMessage', chatSendMessage);
  socket.on('chat.sendMessage', chatSendMessage);

  const chatAddUser = (rawPayload) => {
    const payload = rawPayload || {};
    const username = toFirstNonEmptyUsername(payload);
    if (username) {
      socket.data.username = username;
    }
    emitTopic(io, '/topic/public', payload);
  };
  socket.on('/app/chat.addUser', chatAddUser);
  socket.on('chat.addUser', chatAddUser);

  const boardGetPos = (payload) => emitTopic(io, '/topic/board', payload);
  socket.on('/app/board.getPos', boardGetPos);
  socket.on('board.getPos', boardGetPos);

  socket.onAny((event, ...args) => {
    const payload = args.length > 0 ? args[0] : undefined;

    let match = event.match(/^\/?app\/chat\.getCard\/([^/]+)$/);
    if (match) {
      emitTopic(io, `/topic/card/${match[1]}`, payload);
      return;
    }

    match = event.match(/^\/?app\/waitingRoom\.gameStarted\/([^/]+)$/);
    console.log('Received event:', event, 'with payload:', payload);
    if (match) {
      emitTopic(io, `/topic/gameStarted/${match[1]}`, payload);
      return;
    }

    match = event.match(/^\/?app\/player\.getPlayer\/([^/]+)$/);
    if (match) {
      emitTopic(io, `/topic/currentPlayer/${match[1]}`, payload);
      return;
    }

    match = event.match(/^\/?app\/player\.Move\/([^/]+)$/);
    if (match) {
      emitTopic(io, `/topic/playerMove/${match[1]}`, payload);
      return;
    }

    match = event.match(/^\/?app\/waitingRoom\.notifications\/([^/]+)$/);
    if (match) {
      const matchId = match[1];
      const normalizedPayload = isObject(payload) ? payload : { status: String(payload ?? '') };
      emitTopic(io, `/topic/gameStarted/${matchId}`, normalizedPayload);
    }
  });

  socket.on('disconnect', () => {
    const username = socket.data.username;
    if (typeof username === 'string' && username.trim().length > 0) {
      emitTopic(io, '/topic/public', {
        sender: username,
        type: 'LEAVE',
        content: `${username} disconnected`
      });
    }
  });
};

module.exports = { registerSessionWebsocketHandlers };
