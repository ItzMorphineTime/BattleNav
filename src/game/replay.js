import { DEFAULT_SHIP_TYPE, MAP_MODE, PHASE_COUNT } from "./constants.js";
import { normalizePhasePlan } from "./plan-normalize.js";
import { resolveTurn } from "./simulation.js";
import { cloneState, createInitialState } from "./state.js";

/** @type {1} */
export const REPLAY_FORMAT_VERSION = 1;

/**
 * @typedef {Object} ReplayLobbySnapshot
 * @property {number} playerCount
 * @property {string} p1TypeId
 * @property {string} p2TypeId
 * @property {string} mapMode
 * @property {string} [mapSeed]
 */

/**
 * @typedef {Object} ReplayTurnRecord
 * @property {number} turnNumber
 * @property {Record<string, Array<{move:string, port:Object, starboard:Object}>>} plansByShipId
 */

/**
 * @typedef {Object} ReplayPayload
 * @property {"battleNavReplay"} format
 * @property {number} version
 * @property {string} exportedAt
 * @property {ReplayLobbySnapshot} lobby
 * @property {{ mode: string, seed?: number }} [grid]
 * @property {ReplayTurnRecord[]} turns
 */

/** @param {import("./state.js").PhasePlan[]} plan */
function sanitizePlan(plan) {
  const out = [];
  for (let i = 0; i < PHASE_COUNT; i += 1) {
    const normalized = normalizePhasePlan(plan[i]);
    out.push({
      move: normalized.move,
      port: { kind: normalized.port.kind, ...(normalized.port.shots ? { shots: normalized.port.shots } : {}) },
      starboard: {
        kind: normalized.starboard.kind,
        ...(normalized.starboard.shots ? { shots: normalized.starboard.shots } : {}),
      },
    });
  }
  return out;
}

/**
 * @param {{ lobbySettings: ReplayLobbySnapshot, turns: ReplayTurnRecord[], grid?: import("./state.js").MapGrid }} bundle
 * @returns {ReplayPayload}
 */
export function buildReplayExport({ lobbySettings, turns, grid }) {
  return {
    format: "battleNavReplay",
    version: REPLAY_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    lobby: {
      playerCount: lobbySettings.playerCount,
      p1TypeId: lobbySettings.p1TypeId,
      p2TypeId: lobbySettings.p2TypeId,
      mapMode: lobbySettings.mapMode,
      mapSeed: lobbySettings.mapSeed || "",
    },
    grid: grid
      ? {
          mode: grid.mode,
          ...(typeof grid.seed === "number" ? { seed: grid.seed } : {}),
        }
      : undefined,
    turns: turns.map((t) => ({
      turnNumber: t.turnNumber,
      plansByShipId: Object.fromEntries(
        Object.entries(t.plansByShipId).map(([id, plan]) => [id, sanitizePlan(plan)]),
      ),
    })),
  };
}

/**
 * @param {unknown} data
 * @returns {asserts data is ReplayPayload}
 */
export function assertReplayPayload(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Replay: invalid file.");
  }
  const rec = /** @type {{format?:string,version?:number}} */ (data);
  if (rec.format !== "battleNavReplay") {
    throw new Error("Replay: not a BattleNav replay file.");
  }
  if (rec.version !== REPLAY_FORMAT_VERSION) {
    throw new Error(`Replay: unsupported version (${String(rec.version)}).`);
  }
  const body = /** @type {{ turns?: unknown, lobby?: { playerCount?: unknown } }} */ (data);
  if (!Array.isArray(body.turns)) {
    throw new Error("Replay: missing turns.");
  }
  if (
    !body.lobby ||
    typeof body.lobby !== "object" ||
    ![1, 2].includes(Number(body.lobby.playerCount))
  ) {
    throw new Error("Replay: invalid lobby snapshot.");
  }
}

/**
 * @param {string} jsonText
 * @returns {ReplayPayload}
 */
export function parseReplayJson(jsonText) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Replay: invalid JSON.");
  }
  assertReplayPayload(parsed);
  /** @type {ReplayPayload} */
  const payload = parsed;
  return payload;
}

/**
 * Apply recorded turns with the deterministic engine (no animation).
 * `initialState` must match the lobby + map used when the recording was made.
 * @param {import("./state.js").MatchState} initialState
 * @param {ReplayTurnRecord[]} turns
 * @returns {import("./state.js").MatchState}
 */
export function simulateReplayTurns(initialState, turns) {
  let state = cloneState(initialState);
  const sorted = [...turns].sort((a, b) => a.turnNumber - b.turnNumber);
  for (const entry of sorted) {
    if (state.status === "finished") {
      break;
    }
    const { finalState } = resolveTurn(state, entry.plansByShipId);
    state = finalState;
  }
  return state;
}

/** @param {ReplayPayload} payload */
export function replayLobbySettingsFromPayload(payload) {
  const lobby = payload.lobby;
  return {
    playerCount: Number(lobby.playerCount) === 2 ? 2 : 1,
    p1TypeId: lobby.p1TypeId || DEFAULT_SHIP_TYPE,
    p2TypeId: lobby.p2TypeId || "war_brig",
    mapMode: lobby.mapMode || MAP_MODE.DEFAULT,
    mapSeed: lobby.mapSeed != null ? String(lobby.mapSeed) : "",
  };
}

/**
 * Match-start state only (same as exporting player saw at turn 1), no recorded turns applied.
 * @param {ReplayPayload} payload
 */
export function initialStateFromReplayPayload(payload) {
  const lobby = payload.lobby;
  const proceduralSeed =
    lobby.mapMode === MAP_MODE.PROCEDURAL && lobby.mapSeed ? lobby.mapSeed : undefined;
  /** @type {string|number|undefined} */
  let mapSeed = proceduralSeed;
  if (lobby.mapMode === MAP_MODE.PROCEDURAL && payload.grid && typeof payload.grid.seed === "number") {
    mapSeed = payload.grid.seed;
  }
  return createInitialState({
    p1TypeId: lobby.p1TypeId,
    p2TypeId: lobby.p2TypeId,
    mapMode: lobby.mapMode,
    mapSeed,
  });
}

/**
 * Sort recorded turns for playback order (`turnNumber`).
 * @param {ReplayTurnRecord[]} turns
 */
export function sortedReplayTurns(turns) {
  return [...turns].sort((a, b) => {
    const d = a.turnNumber - b.turnNumber;
    if (d !== 0) {
      return d;
    }
    return 0;
  });
}

/**
 * Rebuild terminal match state (fast-forward import / tests).
 * @param {ReplayPayload} payload
 * @returns {{ state: import("./state.js").MatchState, lobbySettings: ReplayLobbySnapshot }}
 */
export function matchStateFromReplayPayload(payload) {
  let state = initialStateFromReplayPayload(payload);
  state = simulateReplayTurns(state, payload.turns);
  return {
    state,
    lobbySettings: replayLobbySettingsFromPayload(payload),
  };
}
