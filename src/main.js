import { DEFAULT_SHIP_TYPE, MAP_MODE, SHIP_TYPES, TURN_SECONDS } from "./game/constants.js";
import { generateAiPlan } from "./game/ai.js";
import {
  buildReplayExport,
  initialStateFromReplayPayload,
  parseReplayJson,
  replayLobbySettingsFromPayload,
  simulateReplayTurns,
  sortedReplayTurns,
} from "./game/replay.js";
import { resolveTurn } from "./game/simulation.js";
import { cloneState, createInitialState } from "./game/state.js";
import { setHudText } from "./ui/hud.js";
import { playPhaseResults } from "./ui/playback.js";
import { createPlanner } from "./ui/planner.js";
import { Renderer2D } from "./ui/renderer2d.js";
import { TurnTimer } from "./ui/timer.js";

// DOM refs.
const arenaCanvas = document.getElementById("arena-canvas");
const plannerRoot = document.getElementById("planner-root");
const executeEarlyBtn = document.getElementById("execute-early-btn");
const clearPlansBtn = document.getElementById("clear-plans-btn");
const restartBtn = document.getElementById("restart-btn");
const lobbyBtn = document.getElementById("lobby-btn");
const eventLog = document.getElementById("event-log");
const resultBanner = document.getElementById("result-banner");
const lobbyScreen = document.getElementById("lobby-screen");
const gameRoot = document.getElementById("game-root");
const lobbyForm = document.getElementById("lobby-form");
const lobbyPlayers = document.getElementById("lobby-players");
const lobbyP1Type = document.getElementById("lobby-p1-type");
const lobbyP2Type = document.getElementById("lobby-p2-type");
const lobbyMap = document.getElementById("lobby-map");
const lobbySeedField = document.getElementById("lobby-seed-field");
const lobbyMapSeed = document.getElementById("lobby-map-seed");
const lobbyNote = document.getElementById("lobby-note");
const replayImportInput = document.getElementById("replay-import-input");
const lobbyReplayImportInput = document.getElementById("lobby-replay-import-input");
const lobbyImportReplayBtn = document.getElementById("lobby-import-replay-btn");

const exportReplayBtn = document.getElementById("export-replay-btn");
const importReplayBtn = document.getElementById("import-replay-btn");
const replayPlaybackBar = document.getElementById("replay-playback-bar");
const replayPlaybackLabel = document.getElementById("replay-playback-label");
const replayNextBtn = document.getElementById("replay-next-btn");
const replayPlayAllBtn = document.getElementById("replay-play-all-btn");
const replayJumpEndBtn = document.getElementById("replay-jump-end-btn");

const hudRefs = {
  turnEl: document.getElementById("hud-turn"),
  phaseEl: document.getElementById("hud-phase"),
  timerEl: document.getElementById("hud-timer"),
  stateEl: document.getElementById("hud-state"),
};

// Runtime state.
let gameState = createInitialState();
const renderer = new Renderer2D(arenaCanvas, gameState.grid);
let planner = createPlanner(plannerRoot, gameState.ships);
let isExecuting = false;
let replayPlayAllInProgress = false;
let aiEnabled = true;
let lobbySettings = {
  playerCount: 1,
  p1TypeId: DEFAULT_SHIP_TYPE,
  p2TypeId: "war_brig",
  mapMode: MAP_MODE.DEFAULT,
  /** @type {string} */
  mapSeed: "",
};

/** @type {{ turns: Array<{ turnNumber: number, plansByShipId: Record<string, unknown> }> }} */
let replaySession = {
  turns: [],
};

/** Queued replay file turns pending animated playback (@see replayPlaybackTurnsRemain). */
let replayPlayback =
  /** @type {null | { turns: Array<{ turnNumber: number, plansByShipId: Record<string, unknown> }>, nextIndex: number }} */
  null;

// Countdown timer drives auto-execution when it hits zero.
const timer = new TurnTimer(
  TURN_SECONDS,
  (remaining) => {
    setHudText(hudRefs, { timer: remaining });
  },
  () => {
    void executeTurn();
  },
);

/** Append a message to the phase log (most recent at bottom). */
function addLogEntry(message) {
  const li = document.createElement("li");
  li.textContent = message;
  eventLog.append(li);
}

/** Clear the phase log. */
function clearEventLog() {
  eventLog.innerHTML = "";
}

/** @param {{ phase: number }} phaseResult */
function appendPhaseResultToLog(phaseResult) {
  addLogEntry(`Phase ${phaseResult.phase}:`);
  for (const message of phaseResult.movementEvents || []) {
    addLogEntry(` - ${message}`);
  }
  for (const message of phaseResult.hazardEvents || []) {
    addLogEntry(` - ${message}`);
  }
  for (const message of phaseResult.combatEvents || []) {
    addLogEntry(` - ${message}`);
  }
  for (const message of phaseResult.resultEvents || []) {
    addLogEntry(` - ${message}`);
  }
  if (phaseResult.outcome.reason) {
    addLogEntry(` - ${phaseResult.outcome.reason}`);
  }
}

const PLAYBACK_TIMING = {
  moveDurationMs: 520,
  hazardDurationMs: 220,
  combatDurationMs: 420,
  pauseMs: 160,
};

/**
 * Animate phases for one turn (movement + hazards + combat).
 * @param {Array<Object>} phaseResults
 * @param {import("./game/state.js").MatchState} baseState state before resolution
 */
async function runPhaseResultsAnimation(phaseResults, baseState) {
  await playPhaseResults(phaseResults, {
    renderer,
    baseState,
    ...PLAYBACK_TIMING,
    onPhase: async (phaseResult) => {
      setHudText(hudRefs, {
        phase: phaseResult.phase,
        state: "executing",
      });
      appendPhaseResultToLog(phaseResult);
    },
  });
}

function replayPlaybackPending() {
  return Boolean(
    replayPlayback &&
      replayPlayback.turns.length > 0 &&
      replayPlayback.nextIndex < replayPlayback.turns.length,
  );
}

function syncReplayPlaybackBar() {
  if (!replayPlaybackBar || !replayPlaybackLabel) {
    return;
  }
  if (!replayPlaybackPending()) {
    replayPlaybackBar.classList.add("hidden");
    if (replayNextBtn) {
      replayNextBtn.disabled = false;
      replayPlayAllBtn.disabled = false;
      replayJumpEndBtn.disabled = false;
    }
    return;
  }

  replayPlaybackBar.classList.remove("hidden");
  const { turns, nextIndex } = replayPlayback;
  const entry = turns[nextIndex];
  replayPlaybackLabel.textContent = `Replay playback — step ${nextIndex + 1} of ${turns.length} (match turn ${entry.turnNumber}).`;

  const busy = isExecuting || replayPlayAllInProgress;
  replayNextBtn.disabled = busy;
  replayPlayAllBtn.disabled = busy;
  replayJumpEndBtn.disabled = busy;
}

/** Timer off, planner locked; use while a file replay still has turns to show. */
function enterReplayPlaybackMode() {
  timer.stop();
  planner.setDisabled(true);
  executeEarlyBtn.disabled = true;
  clearPlansBtn.disabled = true;
  lobbyBtn.disabled = false;
  setHudText(hudRefs, {
    turn: gameState.turnNumber,
    phase: "-",
    state: "replay",
    timer: "-",
  });
  syncReplayPlaybackBar();
}

/** Show the end-of-match banner. */
function showResult(text) {
  resultBanner.textContent = text;
  resultBanner.classList.remove("hidden");
}

/** Hide the end-of-match banner. */
function hideResult() {
  resultBanner.classList.add("hidden");
  resultBanner.textContent = "";
}

/** Enter planning mode and restart the timer. */
function setPlanningMode() {
  isExecuting = false;
  planner.setDisabled(false);
  planner.setShipDisabled("P2", aiEnabled);
  executeEarlyBtn.disabled = false;
  clearPlansBtn.disabled = false;
  lobbyBtn.disabled = false;
  setHudText(hudRefs, {
    turn: gameState.turnNumber,
    phase: "-",
    state: "planning",
    timer: TURN_SECONDS,
  });
  timer.start();
}

/** Handle end-of-match UI + timer cleanup. */
function endMatch() {
  timer.stop();
  isExecuting = false;
  replayPlayAllInProgress = false;
  replayPlayback = null;
  planner.setDisabled(true);
  executeEarlyBtn.disabled = true;
  clearPlansBtn.disabled = true;
  lobbyBtn.disabled = false;
  setHudText(hudRefs, { state: "finished", phase: "-" });

  if (gameState.draw) {
    showResult("Draw - both captains are lost at sea.");
  } else {
    const winner = gameState.ships.find((ship) => ship.id === gameState.winnerId);
    showResult(`${winner ? winner.name : "Unknown"} wins!`);
  }
  syncReplayPlaybackBar();
}

/** Execute one full 4-phase turn and play back results. */
async function executeTurn() {
  if (isExecuting || gameState.status === "finished") {
    return;
  }
  if (replayPlaybackPending()) {
    return;
  }

  isExecuting = true;
  timer.stop();
  planner.setDisabled(true);
  executeEarlyBtn.disabled = true;
  clearPlansBtn.disabled = true;
  lobbyBtn.disabled = true;
  setHudText(hudRefs, { state: "executing", timer: 0 });

  try {
    const plannerPlans = planner.getPlans();
    const effectivePlans = cloneState(plannerPlans);
    if (aiEnabled) {
      effectivePlans.P2 = generateAiPlan(gameState, "P2", effectivePlans);
    }
    replaySession.turns.push({
      turnNumber: gameState.turnNumber,
      plansByShipId: cloneState(effectivePlans),
    });

    const { finalState, phaseResults } = resolveTurn(gameState, effectivePlans);
    clearEventLog();

    await runPhaseResultsAnimation(phaseResults, gameState);

    gameState = finalState;
    renderer.draw(gameState);
    setHudText(hudRefs, { turn: gameState.turnNumber });
  } finally {
    isExecuting = false;
  }

  if (gameState.status === "finished") {
    endMatch();
  } else {
    planner.clearPlans();
    setPlanningMode();
  }
}

function syncLobbyUiFromSettings() {
  lobbyPlayers.value = String(lobbySettings.playerCount);
  lobbyP1Type.value = lobbySettings.p1TypeId;
  lobbyP2Type.value = lobbySettings.p2TypeId;
  lobbyMap.value = lobbySettings.mapMode;
  if (lobbyMapSeed) {
    lobbyMapSeed.value = lobbySettings.mapSeed;
  }
  updateLobbyNote();
  updateLobbySeedFieldVisibility();
}

/**
 * Restore match + recording from replay JSON (`parseReplayJson` output).
 * @param {ReturnType<typeof parseReplayJson>} payload
 */
function applyReplayPayload(payload) {
  lobbySettings = replayLobbySettingsFromPayload(payload);
  gameState = initialStateFromReplayPayload(payload);
  aiEnabled = lobbySettings.playerCount === 1;

  replaySession.turns = payload.turns.map((t) => ({
    turnNumber: t.turnNumber,
    plansByShipId: cloneState(t.plansByShipId),
  }));

  const ordered = sortedReplayTurns(payload.turns);
  replayPlayback =
    ordered.length === 0
      ? null
      : {
          turns: ordered.map((t) => ({
            turnNumber: t.turnNumber,
            plansByShipId: cloneState(t.plansByShipId),
          })),
          nextIndex: 0,
        };

  hideResult();
  planner = createPlanner(plannerRoot, gameState.ships);
  renderer.draw(gameState);
  clearEventLog();
  if (ordered.length === 0) {
    addLogEntry("Replay loaded: no recorded turns — starting a fresh match from this file’s lobby.");
  } else {
    addLogEntry(
      `Replay loaded: ${ordered.length} recorded turn${ordered.length === 1 ? "" : "s"}. Starting position — use Next turn or Play all below.`,
    );
  }

  syncLobbyUiFromSettings();

  if (ordered.length === 0) {
    setPlanningMode();
  } else {
    enterReplayPlaybackMode();
  }
  hideLobby();
  syncReplayPlaybackBar();
}

async function playOneReplayTurnAnimated() {
  if (!replayPlaybackPending() || isExecuting) {
    return;
  }

  const { turns, nextIndex } = replayPlayback;
  const entry = turns[nextIndex];

  isExecuting = true;
  timer.stop();
  planner.setDisabled(true);
  executeEarlyBtn.disabled = true;
  clearPlansBtn.disabled = true;
  lobbyBtn.disabled = false;
  syncReplayPlaybackBar();

  try {
    const { finalState, phaseResults } = resolveTurn(gameState, entry.plansByShipId);
    addLogEntry(
      `━━ Replay — step ${nextIndex + 1}/${turns.length} (match turn ${entry.turnNumber}) ━━`,
    );
    setHudText(hudRefs, { state: "executing", timer: 0 });

    await runPhaseResultsAnimation(phaseResults, gameState);

    gameState = finalState;
    replayPlayback.nextIndex += 1;
    renderer.draw(gameState);
    setHudText(hudRefs, { turn: gameState.turnNumber });
  } finally {
    isExecuting = false;
  }

  if (gameState.status === "finished") {
    replayPlayback = null;
    syncReplayPlaybackBar();
    endMatch();
    return;
  }

  if (replayPlayback && replayPlayback.nextIndex >= replayPlayback.turns.length) {
    replayPlayback = null;
    syncReplayPlaybackBar();
    planner.clearPlans();
    addLogEntry("Replay finished — you can continue the match from here.");
    setPlanningMode();
    return;
  }

  enterReplayPlaybackMode();
}

async function playReplayAllTurns() {
  if (replayPlayAllInProgress || !replayPlaybackPending()) {
    return;
  }
  replayPlayAllInProgress = true;
  try {
    while (replayPlaybackPending() && gameState.status !== "finished") {
      await playOneReplayTurnAnimated();
    }
  } finally {
    replayPlayAllInProgress = false;
    syncReplayPlaybackBar();
  }
}

function jumpReplayToEnd() {
  if (!replayPlaybackPending()) {
    return;
  }
  const remaining = replayPlayback.turns.slice(replayPlayback.nextIndex);
  timer.stop();
  gameState = simulateReplayTurns(gameState, remaining);
  replayPlayback = null;
  syncReplayPlaybackBar();
  renderer.draw(gameState);
  addLogEntry("Replay jumped to the final recorded state (no animation).");

  if (gameState.status === "finished") {
    endMatch();
  } else {
    planner.clearPlans();
    setPlanningMode();
  }
}

async function handleReplayFileInput(event) {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  try {
    const payload = parseReplayJson(await file.text());
    applyReplayPayload(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alert(msg);
  }
}

function triggerReplayExport() {
  try {
    const payload = buildReplayExport({
      lobbySettings,
      turns: replaySession.turns,
      grid: gameState.grid,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const suffix = replaySession.turns.length
      ? `after-turn-${replaySession.turns[replaySession.turns.length - 1].turnNumber}`
      : "start";
    anchor.download = `battlenav-replay-${suffix}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Could not export replay: ${message}`);
  }
}

/** Reset match state from lobby settings. */
function restartMatch() {
  timer.stop();
  replayPlayAllInProgress = false;
  replaySession.turns = [];
  replayPlayback = null;
  syncReplayPlaybackBar();
  const proceduralSeed =
    lobbySettings.mapMode === MAP_MODE.PROCEDURAL && lobbySettings.mapSeed
      ? lobbySettings.mapSeed
      : undefined;
  gameState = createInitialState({
    p1TypeId: lobbySettings.p1TypeId,
    p2TypeId: lobbySettings.p2TypeId,
    mapMode: lobbySettings.mapMode,
    mapSeed: proceduralSeed,
  });
  aiEnabled = lobbySettings.playerCount === 1;
  hideResult();
  planner = createPlanner(plannerRoot, gameState.ships);
  renderer.draw(gameState);
  clearEventLog();
  setPlanningMode();
}

/** Populate the lobby ship type dropdowns. */
function populateShipTypeSelect(selectElement) {
  selectElement.innerHTML = "";
  for (const type of Object.values(SHIP_TYPES)) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.label;
    selectElement.appendChild(option);
  }
}

/** Update the helper text based on player count. */
function updateLobbyNote() {
  lobbyNote.textContent =
    lobbyPlayers.value === "1"
      ? "P2 will be controlled by AI in 1 Player mode."
      : "Both captains are controlled locally (hotseat).";
}

/** Show procedural seed input only when that map mode is selected. */
function updateLobbySeedFieldVisibility() {
  if (!lobbySeedField) {
    return;
  }
  lobbySeedField.classList.toggle("hidden", lobbyMap.value !== MAP_MODE.PROCEDURAL);
}

/** Switch to lobby screen. */
function showLobby() {
  lobbyScreen.classList.remove("hidden");
  gameRoot.classList.add("hidden");
}

/** Switch to game screen. */
function hideLobby() {
  lobbyScreen.classList.add("hidden");
  gameRoot.classList.remove("hidden");
}

// UI event wiring.
executeEarlyBtn.addEventListener("click", () => {
  void executeTurn();
});

clearPlansBtn.addEventListener("click", () => {
  planner.clearPlans();
});

restartBtn.addEventListener("click", () => {
  restartMatch();
});

lobbyBtn.addEventListener("click", () => {
  timer.stop();
  showLobby();
});

lobbyPlayers.addEventListener("change", () => {
  updateLobbyNote();
});

lobbyMap.addEventListener("change", () => {
  updateLobbySeedFieldVisibility();
});

lobbyImportReplayBtn?.addEventListener("click", () => {
  lobbyReplayImportInput?.click();
});
lobbyReplayImportInput?.addEventListener("change", (event) => {
  void handleReplayFileInput(event);
});

importReplayBtn?.addEventListener("click", () => {
  replayImportInput?.click();
});
replayImportInput?.addEventListener("change", (event) => {
  void handleReplayFileInput(event);
});
exportReplayBtn?.addEventListener("click", () => {
  triggerReplayExport();
});

replayNextBtn?.addEventListener("click", () => {
  void playOneReplayTurnAnimated();
});

replayPlayAllBtn?.addEventListener("click", () => {
  void playReplayAllTurns();
});

replayJumpEndBtn?.addEventListener("click", () => {
  jumpReplayToEnd();
});

lobbyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  lobbySettings = {
    playerCount: Number(lobbyPlayers.value),
    p1TypeId: lobbyP1Type.value,
    p2TypeId: lobbyP2Type.value,
    mapMode: lobbyMap.value,
    mapSeed: lobbyMapSeed ? lobbyMapSeed.value.trim() : "",
  };
  hideLobby();
  restartMatch();
});

populateShipTypeSelect(lobbyP1Type);
populateShipTypeSelect(lobbyP2Type);
lobbyP1Type.value = lobbySettings.p1TypeId;
lobbyP2Type.value = lobbySettings.p2TypeId;
if (lobbyMap) {
  lobbyMap.value = lobbySettings.mapMode;
}
if (lobbyMapSeed) {
  lobbyMapSeed.value = lobbySettings.mapSeed;
}
updateLobbyNote();
updateLobbySeedFieldVisibility();
showLobby();
