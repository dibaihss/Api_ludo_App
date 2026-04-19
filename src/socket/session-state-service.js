const Session = require('../models/Session');

const PLAYER_TYPES = ['red', 'yellow', 'blue', 'green'];
const sessionStates = new Map();

const createEmptyColorMap = () => Object.fromEntries(PLAYER_TYPES.map((color) => [color, []]));

const INITIAL_SOLDIERS = {
  blue: [
    { id: 1, position: '1a', color: 'blue', initialPosition: '1blue', onBoard: true, isOut: false },
    { id: 2, position: '2blue', color: 'blue', initialPosition: '2blue', onBoard: false, isOut: false },
    { id: 3, position: '3blue', color: 'blue', initialPosition: '3blue', onBoard: false, isOut: false },
    { id: 4, position: '4blue', color: 'blue', initialPosition: '4blue', onBoard: false, isOut: false },
  ],
  red: [
    { id: 5, position: '1b', color: 'red', initialPosition: '1red', onBoard: true, isOut: false },
    { id: 6, position: '2red', color: 'red', initialPosition: '2red', onBoard: false, isOut: false },
    { id: 7, position: '3red', color: 'red', initialPosition: '3red', onBoard: false, isOut: false },
    { id: 8, position: '4red', color: 'red', initialPosition: '4red', onBoard: false, isOut: false },
  ],
  yellow: [
    { id: 9, position: '1c', color: 'yellow', initialPosition: '1yellow', onBoard: true, isOut: false },
    { id: 10, position: '2yellow', color: 'yellow', initialPosition: '2yellow', onBoard: false, isOut: false },
    { id: 11, position: '3yellow', color: 'yellow', initialPosition: '3yellow', onBoard: false, isOut: false },
    { id: 12, position: '4yellow', color: 'yellow', initialPosition: '4yellow', onBoard: false, isOut: false },
  ],
  green: [
    { id: 13, position: '1d', color: 'green', initialPosition: '1green', onBoard: true, isOut: false },
    { id: 14, position: '2green', color: 'green', initialPosition: '2green', onBoard: false, isOut: false },
    { id: 15, position: '3green', color: 'green', initialPosition: '3green', onBoard: false, isOut: false },
    { id: 16, position: '4green', color: 'green', initialPosition: '4green', onBoard: false, isOut: false },
  ],
};

const INITIAL_CARDS = {
  blue: [
    { id: 1, used: false, value: 1 },
    { id: 2, used: false, value: 2 },
    { id: 3, used: false, value: 3 },
    { id: 4, used: false, value: 4 },
    { id: 5, used: false, value: 5 },
    { id: 6, used: false, value: 6 },
  ],
  red: [
    { id: 7, used: false, value: 1 },
    { id: 8, used: false, value: 2 },
    { id: 9, used: false, value: 3 },
    { id: 10, used: false, value: 4 },
    { id: 11, used: false, value: 5 },
    { id: 12, used: false, value: 6 },
  ],
  yellow: [
    { id: 13, used: false, value: 1 },
    { id: 14, used: false, value: 2 },
    { id: 15, used: false, value: 3 },
    { id: 16, used: false, value: 4 },
    { id: 17, used: false, value: 5 },
    { id: 18, used: false, value: 6 },
  ],
  green: [
    { id: 19, used: false, value: 1 },
    { id: 20, used: false, value: 2 },
    { id: 21, used: false, value: 3 },
    { id: 22, used: false, value: 4 },
    { id: 23, used: false, value: 5 },
    { id: 24, used: false, value: 6 },
  ],
};

const createInitialSoldiers = () => cloneColorMap(INITIAL_SOLDIERS, normalizeSoldier);
const createInitialCards = () => cloneColorMap(INITIAL_CARDS, normalizeCard);

const cloneColorMap = (colorMap, itemMapper) => PLAYER_TYPES.reduce((accumulator, color) => {
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
    activePlayer: 'green',
    currentPlayer: null,
    timeRemaining: 35,
    isTimerRunning: false,
    stateVersion: 0,
    status: 'waiting',
    soldiers: createInitialSoldiers(),
    cards: createInitialCards(),
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
  playerColors: null,
  snapshot: {
    activePlayer: 'blue',
    currentPlayer: null,
    timeRemaining: 35,
    isTimerRunning: false,
    stateVersion: 0,
    status: 'waiting',
    soldiers: createInitialSoldiers(),
    cards: createInitialCards(),
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
    // stateVersion intentionally NOT incremented — player selection is informational,
    // not a game state mutation. Incrementing here causes the bot's subsequent
    // player.Move to always arrive with a stale version.
    stateVersion: state.snapshot.stateVersion,
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

const storePlayerColors = (sessionId, playerColors) => {
  if (!playerColors || typeof playerColors !== 'object' || Array.isArray(playerColors)) return;

  updateState(sessionId, (state) => ({ ...state, playerColors }));
};

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

const FRONTEND_INITIAL_STATE = {
  currentPlayer: null,
  activePlayer: null,
  stateVersion: 0,
  isOnline: false,
  timeRemaining: 0,
  isTimerRunning: false,
  unActivePlayers: [],
  gamePaused: false,
  disconnectedPlayer: null,
  availableTypes: PLAYER_TYPES,
  playerColors: {
    blue: 1,
    red: 1,
    yellow: 1,
    green: 1,
  },
  currentPlayerColor: null,
  blueSoldiers: [],
  redSoldiers: [],
  yellowSoldiers: [],
  greenSoldiers: [],
  blueCards: [],
  redCards: [],
  yellowCards: [],
  greenCards: [],
};

const mapGameStateToFrontendState = (gameState) => {
  const state = gameState || {};

  return {
    ...FRONTEND_INITIAL_STATE,

    activePlayer: state.activePlayer ?? null,
    currentPlayer: state.currentPlayer?.color ?? state.activePlayer ?? null,
    currentPlayerColor: state.currentPlayer?.color ?? state.activePlayer ?? null,
    stateVersion: state.stateVersion ?? 0,
    timeRemaining: state.timeRemaining ?? 0,
    isTimerRunning: Boolean(state.isTimerRunning),

    blueSoldiers: [ 
      { id: 1, used: false, value: 1 },
        { id: 2, used: false, value: 2 },
        { id: 3, used: false, value: 3 },
        { id: 4, used: false, value: 4 },
        { id: 5, used: false, value: 5 },
        { id: 6, used: false, value: 6 }
      ],
    redSoldiers: [  { id: 7, used: false, value: 1 },
        { id: 8, used: false, value: 2 },
        { id: 9, used: false, value: 3 },
        { id: 10, used: false, value: 4 },
        { id: 11, used: false, value: 5 },
        { id: 12, used: false, value: 6 }
      ],
    yellowSoldiers:  [    { id: 13, used: false, value: 1 },
        { id: 14, used: false, value: 2 },
        { id: 15, used: false, value: 3 },
        { id: 16, used: false, value: 4 },
        { id: 17, used: false, value: 5 },
        { id: 18, used: false, value: 6 }
      ],
    greenSoldiers: [  { id: 19, used: false, value: 1 },
        { id: 20, used: false, value: 2 },
        { id: 21, used: false, value: 3 },
        { id: 22, used: false, value: 4 },
        { id: 23, used: false, value: 5 },
        { id: 24, used: false, value: 6 }
      ],

    blueCards: Array.isArray(state.cards?.blue) ? state.cards.blue : [],
    redCards: Array.isArray(state.cards?.red) ? state.cards.red : [],
    yellowCards: Array.isArray(state.cards?.yellow) ? state.cards.yellow : [],
    greenCards: Array.isArray(state.cards?.green) ? state.cards.green : [],

    isOnline: state.status === 'active',
    gamePaused: state.status === 'paused',
  };
};

module.exports = {
  getGameState,
  getOrCreateState,
  recordCurrentPlayer,
  recordGameStarted,
  recordNotification,
  recordPlayerMove,
  registerParticipant,
  storePlayerColors,
};