import { DEFAULT_SHIP_TYPE, MAP_MODE, SHIP_TYPES, TURN_SECONDS } from "./game/constants.js";
import { generateAiPlan } from "./game/ai.js";
import { resolveTurn } from "./game/simulation.js";
import { createInitialState } from "./game/state.js";
import { setHudText } from "./ui/hud.js";
import { playPhaseResults } from "./ui/playback.js";
import { createPlanner } from "./ui/planner.js";
import { Renderer2D } from "./ui/renderer2d.js";
import { TurnTimer } from "./ui/timer.js";

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
const lobbyNote = document.getElementById("lobby-note");

const hudRefs = {
  turnEl: document.getElementById("hud-turn"),
  phaseEl: document.getElementById("hud-phase"),
  timerEl: document.getElementById("hud-timer"),
  stateEl: document.getElementById("hud-state"),
};

let gameState = createInitialState();
const renderer = new Renderer2D(arenaCanvas, gameState.grid);
let planner = createPlanner(plannerRoot, gameState.ships);
let isExecuting = false;
let aiEnabled = true;
let lobbySettings = {
  playerCount: 1,
  p1TypeId: DEFAULT_SHIP_TYPE,
  p2TypeId: "war_brig",
  mapMode: MAP_MODE.DEFAULT,
};

const timer = new TurnTimer(
  TURN_SECONDS,
  (remaining) => {
    setHudText(hudRefs, { timer: remaining });
  },
  () => {
    void executeTurn();
  },
);

function addLogEntry(message) {
  const li = document.createElement("li");
  li.textContent = message;
  eventLog.prepend(li);
}

function clearEventLog() {
  eventLog.innerHTML = "";
}

function showResult(text) {
  resultBanner.textContent = text;
  resultBanner.classList.remove("hidden");
}

function hideResult() {
  resultBanner.classList.add("hidden");
  resultBanner.textContent = "";
}

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

function endMatch() {
  timer.stop();
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
}

async function executeTurn() {
  if (isExecuting || gameState.status === "finished") {
    return;
  }

  isExecuting = true;
  timer.stop();
  planner.setDisabled(true);
  executeEarlyBtn.disabled = true;
  clearPlansBtn.disabled = true;
  lobbyBtn.disabled = true;
  setHudText(hudRefs, { state: "executing", timer: 0 });

  const plansByShipId = planner.getPlans();
  if (aiEnabled) {
    const aiPlan = generateAiPlan(gameState, "P2");
    plansByShipId.P2 = aiPlan;
  }
  const { finalState, phaseResults } = resolveTurn(gameState, plansByShipId);
  clearEventLog();

  await playPhaseResults(phaseResults, {
    delayMs: 850,
    onPhase: async (phaseResult) => {
      setHudText(hudRefs, {
        phase: phaseResult.phase,
        state: "executing",
      });

      renderer.draw(
        {
          ...gameState,
          ships: phaseResult.shipsAfterPhase,
        },
        {
          traces: phaseResult.traces,
        },
      );

      addLogEntry(`Phase ${phaseResult.phase}:`);
      for (const message of phaseResult.movementEvents) {
        addLogEntry(` - ${message}`);
      }
      for (const message of phaseResult.hazardEvents) {
        addLogEntry(` - ${message}`);
      }
      for (const message of phaseResult.combatEvents) {
        addLogEntry(` - ${message}`);
      }
      for (const message of phaseResult.resultEvents) {
        addLogEntry(` - ${message}`);
      }
      if (phaseResult.outcome.reason) {
        addLogEntry(` - ${phaseResult.outcome.reason}`);
      }
    },
  });

  gameState = finalState;
  renderer.draw(gameState);
  setHudText(hudRefs, { turn: gameState.turnNumber });

  if (gameState.status === "finished") {
    endMatch();
  } else {
    planner.clearPlans();
    setPlanningMode();
  }
}

function restartMatch() {
  timer.stop();
  gameState = createInitialState({
    p1TypeId: lobbySettings.p1TypeId,
    p2TypeId: lobbySettings.p2TypeId,
    mapMode: lobbySettings.mapMode,
  });
  aiEnabled = lobbySettings.playerCount === 1;
  hideResult();
  planner = createPlanner(plannerRoot, gameState.ships);
  renderer.draw(gameState);
  clearEventLog();
  setPlanningMode();
}

function populateShipTypeSelect(selectElement) {
  selectElement.innerHTML = "";
  for (const type of Object.values(SHIP_TYPES)) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.label;
    selectElement.appendChild(option);
  }
}

function updateLobbyNote() {
  lobbyNote.textContent =
    lobbyPlayers.value === "1"
      ? "P2 will be controlled by AI in 1 Player mode."
      : "Both captains are controlled locally (hotseat).";
}

function showLobby() {
  lobbyScreen.classList.remove("hidden");
  gameRoot.classList.add("hidden");
}

function hideLobby() {
  lobbyScreen.classList.add("hidden");
  gameRoot.classList.remove("hidden");
}

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

lobbyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  lobbySettings = {
    playerCount: Number(lobbyPlayers.value),
    p1TypeId: lobbyP1Type.value,
    p2TypeId: lobbyP2Type.value,
    mapMode: lobbyMap.value,
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
updateLobbyNote();
showLobby();
