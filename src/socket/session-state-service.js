const Session = require('../models/Session');

const PLAYER_COLORS = ['blue', 'red', 'yellow', 'green'];
const sessionStates = new Map();

const createEmptyColorMap = () => Object.fromEntries(PLAYER_COLORS.map((color) => [color, []]));

const cloneColorMap = (colorMap, itemMapper) => PLAYER_COLORS.reduce((accumulator, color) => {
  accumulator[color] = Array.isArray(colorMap?.[color])
    ? colorMap[color].map((item) => itemMapper(item)).filter(Boolean)
    : [];
  return accumulator;
}, {});

const normalizeSoldier = (soldier) => {
  if (!soldier || typeof soldier !== 'object' || Array.isArray(soldier)) {
    return null;
  }

  return {
    id: soldier.id ?? null,
    position: soldier.position ?? null,
    color: soldier.color ?? null,
    initialPosition: soldier.initialPosition ?? null,
    onBoard: Boolean(soldier.onBoard),
    isOut: Boolean(soldier.isOut),
  };
};

const normalizeCard = (card) => {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    return null;
  }

  return {
    id: card.id ?? null,
    used: Boolean(card.used),
    value: card.value ?? null,
  };
};

const hasSnapshotFields = (candidate) => Boolean(
  candidate
  && typeof candidate === 'object'
  && !Array.isArray(candidate)
  && (
    'activePlayer' in candidate
    || 'currentPlayer' in candidate
    || 'timeRemaining' in candidate
    || 'timer' in candidate
    || 'isTimerRunning' in candidate
    || 'stateVersion' in candidate
    || 'status' in candidate
    || 'soldiers' in candidate
    || 'cards' in candidate
  )
);

const extractSnapshotCandidate = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const candidates = [payload.gameState, payload.snapshot, payload.payload, payload];
  return candidates.find(hasSnapshotFields) || null;
};

const mergeCurrentPlayerIntoSoldiers = (soldiers, currentPlayer) => {
  if (!currentPlayer?.color || !Array.isArray(soldiers[currentPlayer.color])) {
    return soldiers;
  }

  const alreadyPresent = soldiers[currentPlayer.color].some((soldier) => soldier.id === currentPlayer.id);
  if (alreadyPresent) {
    return soldiers;
  }

  return {
    ...soldiers,
    [currentPlayer.color]: [...soldiers[currentPlayer.color], currentPlayer],
  };
};

const normalizeStatus = (status, started = false) => {
  if (status === 'in_progress') {
    return 'active';
  }
  if (status) {
    return status;
  }
  return started ? 'active' : 'waiting';
};

const toSnapshot = (previousSnapshot, snapshotLike = {}) => {
  const fallbackSnapshot = previousSnapshot || {
    activePlayer: null,
    currentPlayer: null,
    timeRemaining: 0,
    isTimerRunning: false,
    stateVersion: 0,
    status: 'waiting',
    soldiers: createEmptyColorMap(),
    cards: createEmptyColorMap(),
  };

  const currentPlayer = normalizeSoldier(snapshotLike.currentPlayer) || fallbackSnapshot.currentPlayer;
  const soldiers = snapshotLike.soldiers
    ? cloneColorMap(snapshotLike.soldiers, normalizeSoldier)
    : cloneColorMap(fallbackSnapshot.soldiers, normalizeSoldier);
  const normalizedSoldiers = mergeCurrentPlayerIntoSoldiers(soldiers, currentPlayer);
  const cards = snapshotLike.cards
    ? cloneColorMap(snapshotLike.cards, normalizeCard)
    : cloneColorMap(fallbackSnapshot.cards, normalizeCard);

  return {
    activePlayer: snapshotLike.activePlayer ?? currentPlayer?.color ?? fallbackSnapshot.activePlayer,
    currentPlayer,
    timeRemaining: snapshotLike.timeRemaining ?? snapshotLike.timer?.timeRemaining ?? fallbackSnapshot.timeRemaining,
    isTimerRunning: snapshotLike.isTimerRunning ?? snapshotLike.timer?.isRunning ?? fallbackSnapshot.isTimerRunning,
    stateVersion: snapshotLike.stateVersion ?? fallbackSnapshot.stateVersion,
    status: normalizeStatus(snapshotLike.status, snapshotLike.started),
    soldiers: normalizedSoldiers,
    cards,
  };
};

const deriveNextSnapshot = (state, payload, overrides = {}) => {
  const snapshotCandidate = extractSnapshotCandidate(payload);
  const baseSnapshot = {
    ...state.snapshot,
    ...(snapshotCandidate ? toSnapshot(state.snapshot, snapshotCandidate) : {}),
    ...overrides,
  };

  return toSnapshot(state.snapshot, baseSnapshot);
};

const createDefaultState = (sessionId) => ({
  sessionId,
  started: false,
  lastMove: null,
  lastNotification: null,
  lastEvent: null,
  participants: {},
  snapshot: {
    activePlayer: null,
    currentPlayer: null,
    timeRemaining: 0,
    isTimerRunning: false,
    stateVersion: 0,
    status: 'waiting',
    soldiers: createEmptyColorMap(),
    cards: createEmptyColorMap(),
  },
  updatedAt: new Date().toISOString(),
});

const touchState = (state) => ({
  ...state,
  updatedAt: new Date().toISOString(),
});

const getOrCreateState = (sessionId) => {
  const normalizedSessionId = String(sessionId);
  const existingState = sessionStates.get(normalizedSessionId);

  if (existingState) {
    return existingState;
  }

  const newState = createDefaultState(normalizedSessionId);
  sessionStates.set(normalizedSessionId, newState);
  return newState;
};

const updateState = (sessionId, updater) => {
  const currentState = getOrCreateState(sessionId);
  const nextState = touchState(updater(currentState));
  sessionStates.set(String(sessionId), nextState);
  return nextState;
};

const toParticipant = (payload = {}) => {
  const userId = payload.userId || payload.id || null;
  const username = payload.sender || payload.username || payload.name || null;

  return {
    userId,
    username,
    sessionId: payload.sessionId || payload.matchId || null,
  };
};

const registerParticipant = (sessionId, payload = {}) => {
  const participant = toParticipant(payload);

  if (!participant.userId && !participant.username) {
    return getOrCreateState(sessionId);
  }

  const participantKey = participant.userId || participant.username;

  return updateState(sessionId, (state) => ({
    ...state,
    participants: {
      ...state.participants,
      [participantKey]: {
        ...state.participants[participantKey],
        ...participant,
      }
    }
  }));
};

const recordGameStarted = (sessionId, payload) => updateState(sessionId, (state) => ({
  ...state,
  started: true,
  snapshot: deriveNextSnapshot(state, payload, {
    status: 'active',
    stateVersion: state.snapshot.stateVersion + 1,
  }),
  lastEvent: payload || null,
}));

const recordCurrentPlayer = (sessionId, payload) => updateState(sessionId, (state) => ({
  ...state,
  snapshot: deriveNextSnapshot(state, payload, {
    currentPlayer: normalizeSoldier(payload) || state.snapshot.currentPlayer,
    activePlayer: payload?.color || state.snapshot.activePlayer,
    stateVersion: state.snapshot.stateVersion + 1,
  }),
  lastEvent: payload || null,
}));

const recordPlayerMove = (sessionId, payload) => updateState(sessionId, (state) => ({
  ...state,
  snapshot: deriveNextSnapshot(state, payload, {
    stateVersion: state.snapshot.stateVersion + 1,
  }),
  lastMove: payload || null,
  lastEvent: payload || null,
}));

const recordNotification = (sessionId, payload) => updateState(sessionId, (state) => ({
  ...state,
  snapshot: deriveNextSnapshot(state, payload, {
    stateVersion: state.snapshot.stateVersion + 1,
  }),
  lastNotification: payload || null,
  lastEvent: payload || null,
}));

const getGameState = async (sessionId) => {
  const normalizedSessionId = String(sessionId);
  const socketState = getOrCreateState(normalizedSessionId);
  const sessionWithUsers = await Session.findByIdWithUsers(normalizedSessionId);
  const sessionStatus = normalizeStatus(sessionWithUsers?.status, socketState.started);

  return toSnapshot(socketState.snapshot, {
    ...socketState.snapshot,
    status: socketState.snapshot.status === 'waiting' ? sessionStatus : socketState.snapshot.status,
  });
};

module.exports = {
  getGameState,
  recordCurrentPlayer,
  recordGameStarted,
  recordNotification,
  recordPlayerMove,
  registerParticipant,
};