const {
  getGameState,
  getOrCreateState,
  recordCurrentPlayer,
  recordGameStarted,
  recordNotification,
  recordPlayerMove,
  registerParticipant,
  storePlayerColors,
} = require('./session-state-service');

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

const safeCallback = (callback, response) => {
  if (typeof callback === 'function') {
    callback(response);
  }
};

const ackOk = (callback) => {
  safeCallback(callback, { status: 'ok' });
};

const emitAuthoritativeGameState = async (io, matchId) => {
  const gameState = await getGameState(matchId);
  emitTopic(io, `/topic/gameState/${matchId}`, gameState);
  return gameState;
};

const normalizeNotificationPayload = (payload) => (
  isObject(payload)
    ? payload
    : { status: String(payload ?? '') }
);

const updateSocketDataFromNotification = (socket, matchId, payload) => {
  if (!socket.data.sessionId) {
    socket.data.sessionId = matchId;
  }

  if (!isObject(payload)) {
    return;
  }

  if (payload.userId && !socket.data.userId) {
    socket.data.userId = payload.userId;
  }
  if (payload.sender && !socket.data.sender) {
    socket.data.sender = payload.sender;
  }
  if (payload.sessionId) {
    socket.data.sessionId = payload.sessionId;
  }
};

const handlePlayerMove = async (io, socket, matchId, payload, callback) => {
  if (isObject(payload) && !socket.data.userId && payload.userId) {
    socket.data.userId = payload.userId;
  }

  if (isObject(payload) && payload.userId !== socket.data.userId) {
    safeCallback(callback, { status: 'error', reason: 'not_your_turn' });
    return true;
  }

  if (isObject(payload) && payload.sessionId) {
    socket.data.sessionId = payload.sessionId;
  }

  // ── stateVersion validation ────────────────────────────────────────
  const clientVersion = isObject(payload?.gameState)
    ? payload.gameState.stateVersion
    : undefined;
  if (typeof clientVersion === 'number') {
    const serverState = getOrCreateState(matchId);
    const serverVersion = serverState.snapshot.stateVersion;
    if (clientVersion !== serverVersion) {
      console.warn(
        `Stale state from ${payload.userId}: client v${clientVersion} server v${serverVersion}`
      );
      // Broadcast authoritative state to ALL clients so everyone resyncs
      await emitAuthoritativeGameState(io, matchId);
      safeCallback(callback, {
        status: 'error',
        reason: 'stale_state',
        serverVersion,
      });
      return true;
    }
  }

  // ── color ownership check ──────────────────────────────────────────
  const claimedColor = payload?.payload?.color;
  if (claimedColor) {
    const sessionState = getOrCreateState(matchId);
    if (sessionState.playerColors) {
      const ownerUserId = sessionState.playerColors[claimedColor];
      if (ownerUserId && String(ownerUserId) !== String(payload.userId)) {
        safeCallback(callback, { status: 'error', reason: 'not_your_color' });
        return true;
      }
    }
  }

  registerParticipant(matchId, {
    ...(isObject(payload) ? payload : {}),
    sessionId: isObject(payload) && payload.sessionId ? payload.sessionId : matchId,
    userId: isObject(payload) ? payload.userId : socket.data.userId,
  });
  const updatedState = recordPlayerMove(matchId, payload);
  const newVersion = updatedState.snapshot.stateVersion;

  // Augment broadcast with server's new stateVersion
  emitTopic(io, `/topic/playerMove/${matchId}`, {
    ...(isObject(payload) ? payload : {}),
    stateVersion: newVersion,
  });
  safeCallback(callback, { status: 'ok', newVersion });
  return true;
};

const routeDynamicEvent = async (io, socket, event, payload, callback) => {
  let match = event.match(/^\/?app\/chat\.getCard\/([^/]+)$/);
  if (match) {
    emitTopic(io, `/topic/card/${match[1]}`, payload);
    ackOk(callback);
    return true;
  }

  match = event.match(/^\/?app\/waitingRoom\.gameStarted\/([^/]+)$/);
  console.log('Received event:', event, 'with payload:', payload);
  if (match) {
    const matchId = match[1];

    // Store playerColors mapping sent by the host when the game starts
    if (isObject(payload) && payload.type === 'startGame' && isObject(payload.playerColors)) {
      storePlayerColors(matchId, payload.playerColors);
    }

    recordGameStarted(matchId, payload);
    emitTopic(io, `/topic/gameStarted/${matchId}`, payload);
    ackOk(callback);
    return true;
  }

  match = event.match(/^\/?app\/player\.getPlayer\/([^/]+)$/);
  if (match) {
    recordCurrentPlayer(match[1], payload);
    emitTopic(io, `/topic/currentPlayer/${match[1]}`, payload);
    ackOk(callback);
    return true;
  }

  match = event.match(/^\/?app\/player\.Move\/([^/]+)$/);
  if (match) {
    return handlePlayerMove(io, socket, match[1], payload, callback);
  }

  match = event.match(/^\/?app\/waitingRoom\.notifications\/([^/]+)$/);
  if (match) {
    const matchId = match[1];
    updateSocketDataFromNotification(socket, matchId, payload);
    registerParticipant(matchId, payload);
    const normalizedPayload = normalizeNotificationPayload(payload);
    recordNotification(matchId, normalizedPayload);
    emitTopic(io, `/topic/gameStarted/${matchId}`, normalizedPayload);
    await emitAuthoritativeGameState(io, matchId);
    ackOk(callback);
    return true;
  }

  return false;
};

const registerSessionWebsocketHandlers = (io, socket) => {
  socket.data = {
    sender: null,
    username: null,
    userId: null,
    sessionId: null,
  };

  const chatSendMessage = (payload, callback) => {
    try {
      emitTopic(io, '/topic/public', payload);
      safeCallback(callback, { status: 'ok' });
    } catch (err) {
      console.error('chatSendMessage error:', err);
      safeCallback(callback, { status: 'error', reason: err.message });
    }
  };
  socket.on('/app/chat.sendMessage', chatSendMessage);
  socket.on('chat.sendMessage', chatSendMessage);

  const chatAddUser = (rawPayload, callback) => {
    try {
      const payload = rawPayload || {};
      const username = toFirstNonEmptyUsername(payload);
      console.log('Adding user with payload:', payload);

      if (!username) {
        return safeCallback(callback, { status: 'error', reason: 'missing_username' });
      }

      socket.data.sender = username;
      socket.data.username = username;
      socket.data.userId = payload.userId || payload.id || null;
      socket.data.sessionId = payload.sessionId || payload.matchId || null;

      if (socket.data.sessionId) {
        registerParticipant(socket.data.sessionId, {
          sender: socket.data.sender,
          username: socket.data.username,
          userId: socket.data.userId,
          sessionId: socket.data.sessionId,
        });
      }

      console.log('socket.data after chatAddUser:', socket.data);

      emitTopic(io, '/topic/public', payload);
      safeCallback(callback, {
        status: 'ok',
        user: {
          sender: socket.data.sender,
          userId: socket.data.userId,
          sessionId: socket.data.sessionId,
        }
      });
    } catch (err) {
      console.error('chatAddUser error:', err);
      safeCallback(callback, { status: 'error', reason: err.message });
    }
  };
  socket.on('/app/chat.addUser', chatAddUser);
  socket.on('chat.addUser', chatAddUser);

  const requestGameState = async (rawPayload, callback) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      const sessionId = payload.sessionId || socket.data.sessionId;

      if (!sessionId) {
        safeCallback(callback, { status: 'error', reason: 'missing_session_id' });
        return;
      }

      socket.data.sessionId = sessionId;

      if (payload.userId && !socket.data.userId) {
        socket.data.userId = payload.userId;
      }
      if (payload.sender && !socket.data.sender) {
        socket.data.sender = payload.sender;
      }

      registerParticipant(sessionId, {
        ...payload,
        sessionId,
        userId: payload.userId || socket.data.userId,
        sender: payload.sender || socket.data.sender,
      });

      const gameState = await getGameState(sessionId);
      safeCallback(callback, { status: 'ok', gameState });
    } catch (err) {
      console.error('requestGameState error:', err);
      safeCallback(callback, { status: 'error', reason: err.message });
    }
  };
  socket.on('requestGameState', requestGameState);

  const boardGetPos = (payload, callback) => {
    try {
      emitTopic(io, '/topic/board', payload);
      safeCallback(callback, { status: 'ok' });
    } catch (err) {
      console.error('boardGetPos error:', err);
      safeCallback(callback, { status: 'error', reason: err.message });
    }
  };
  socket.on('/app/board.getPos', boardGetPos);
  socket.on('board.getPos', boardGetPos);

  socket.onAny((event, ...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
    const payload = args.length > 0 ? args[0] : undefined;

    void routeDynamicEvent(io, socket, event, payload, callback).catch((err) => {
      console.error(`Error handling event ${event}:`, err);
      safeCallback(callback, { status: 'error', reason: err.message });
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected - socket.data:', socket.data);

    const { sender, userId, sessionId } = socket.data;

    if (!sessionId) {
      console.warn('Disconnect: sessionId missing, skipping emit');
      return;
    }
    if (!sender) {
      console.warn('Disconnect: sender missing, skipping emit');
      return;
    }

    console.log(`Emitting userDisconnected -> session: ${sessionId}, user: ${sender}`);

    emitTopic(io, `/topic/gameStarted/${sessionId}`, {
      sender,
      type: 'userDisconnected',
      userId,
      content: `${sender} disconnected`,
    });
      emitTopic(io, `/topic/playerMove/${sessionId}`, {
      sender,
      type: 'userDisconnected',
      userId,
      content: `${sender} disconnected`,
    });
  });
};

module.exports = { registerSessionWebsocketHandlers };
