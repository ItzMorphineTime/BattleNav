import {
  ACTION,
  ACTION_KIND,
  DEFAULT_CANNONBALL_SIZE,
  DEFAULT_SHOTS_PER_ATTACK,
  MOVE,
  PHASE_COUNT,
  SIDE,
} from "../game/constants.js";
import { createEmptyPlan } from "../game/state.js";

const MOVE_CYCLE = [MOVE.TURN_LEFT, MOVE.FORWARD, MOVE.TURN_RIGHT, MOVE.NONE];
const ACTION_MODE = Object.freeze({
  NONE: "none",
  FIRE1: "fire_1",
  FIRE2: "fire_2",
  GRAPPLE: "grapple",
});

const MOVE_LABELS = {
  [MOVE.NONE]: "Hold Position",
  [MOVE.FORWARD]: "Forward",
  [MOVE.TURN_LEFT]: "Turn Left",
  [MOVE.TURN_RIGHT]: "Turn Right",
};

const ACTION_LABELS = {
  [ACTION_KIND.NONE]: "None",
  [ACTION_KIND.FIRE]: "Fire",
  [ACTION_KIND.GRAPPLE]: "Grapple",
};

/** Advance to the next value in a cyclic list. */
function nextCycleValue(list, current) {
  const index = list.indexOf(current);
  if (index === -1) {
    return list[0];
  }
  return list[(index + 1) % list.length];
}

/**
 * Create a circular action button for port/starboard actions.
 * @param {string} side
 * @param {number} slotIndex
 * @param {number} slotCount
 */
function createActionButton(side, slotIndex, slotCount) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-btn ${side}`;
  button.dataset.side = side;
  button.dataset.action = ACTION_KIND.NONE;
  button.dataset.slot = String(slotIndex);

  const label = document.createElement("span");
  label.className = "action-text";
  label.textContent = "-";
  button.appendChild(label);

  if (slotCount > 1) {
    const slot = document.createElement("span");
    slot.className = "action-slot";
    slot.textContent = String(slotIndex + 1);
    button.appendChild(slot);
  }

  return button;
}

/** Create the central movement tile. */
function createMoveButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-tile";
  button.dataset.move = MOVE.NONE;
  button.title = MOVE_LABELS[MOVE.NONE];
  return button;
}

/** Update action button UI state. */
function updateActionButton(button, sideLabel, action) {
  button.dataset.action = action;
  const label = button.querySelector(".action-text");
  if (label) {
    label.textContent =
      action === ACTION_KIND.NONE ? "-" : action === ACTION_KIND.FIRE ? "F" : "G";
  }
  const labelText = ACTION_LABELS[action] || ACTION_LABELS[ACTION_KIND.NONE];
  const slot = button.dataset.slot ? ` #${Number(button.dataset.slot) + 1}` : "";
  button.title = `${sideLabel}${slot}: ${labelText}`;
}

/** Update move button UI state. */
function updateMoveButton(button, move) {
  button.dataset.move = move;
  button.title = `Move: ${MOVE_LABELS[move] || MOVE_LABELS[MOVE.NONE]}`;
}

function getSideMode(actions, shotSlots) {
  if (actions.includes(ACTION_KIND.GRAPPLE)) {
    return ACTION_MODE.GRAPPLE;
  }
  const fireCount = actions.filter((value) => value === ACTION_KIND.FIRE).length;
  if (fireCount <= 0) {
    return ACTION_MODE.NONE;
  }
  if (shotSlots > 1 && fireCount > 1) {
    return ACTION_MODE.FIRE2;
  }
  return ACTION_MODE.FIRE1;
}

function applySideMode(actions, mode, shotSlots) {
  actions.fill(ACTION_KIND.NONE);
  if (mode === ACTION_MODE.FIRE1) {
    actions[0] = ACTION_KIND.FIRE;
  } else if (mode === ACTION_MODE.FIRE2) {
    actions[0] = ACTION_KIND.FIRE;
    if (shotSlots > 1) {
      actions[1] = ACTION_KIND.FIRE;
    }
  } else if (mode === ACTION_MODE.GRAPPLE) {
    actions[0] = ACTION_KIND.GRAPPLE;
  }
}

function nextSideMode(currentMode, shotSlots) {
  if (currentMode === ACTION_MODE.NONE) {
    return ACTION_MODE.FIRE1;
  }
  if (currentMode === ACTION_MODE.FIRE1) {
    return shotSlots > 1 ? ACTION_MODE.FIRE2 : ACTION_MODE.GRAPPLE;
  }
  if (currentMode === ACTION_MODE.FIRE2) {
    return ACTION_MODE.GRAPPLE;
  }
  return ACTION_MODE.NONE;
}

/**
 * Build a planner UI for each ship and return plan accessors.
 * @param {HTMLElement} rootElement
 * @param {Array<import("../game/state.js").ShipState>} ships
 */
export function createPlanner(rootElement, ships) {
  const rowsByShipId = {};
  rootElement.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "planner-root-grid";

  for (const ship of ships) {
    const section = document.createElement("section");
    section.className = "ship-plan";

    const title = document.createElement("h3");
    const typeLabel = ship.typeLabel ? ` (${ship.typeLabel})` : "";
    title.textContent = `${ship.name}${typeLabel}`;
    section.appendChild(title);

    const stats = document.createElement("div");
    stats.className = "ship-stats";
    const shotCount = ship.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK;
    const ballSize = ship.cannonballSize ? ship.cannonballSize : DEFAULT_CANNONBALL_SIZE;
    const range = ship.cannonRange ?? "-";
    stats.textContent = `Shots: ${shotCount} | Ball: ${ballSize} | Range: ${range}`;
    section.appendChild(stats);

    const stack = document.createElement("div");
    stack.className = "phase-stack";

    rowsByShipId[ship.id] = [];

    for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
      const row = document.createElement("div");
      row.className = "phase-row";

      const phaseLabel = document.createElement("label");
      phaseLabel.className = "phase-label";
      phaseLabel.textContent = `P${phase + 1}`;

      const shotSlots = Math.max(1, ship.shotsPerAttack ?? DEFAULT_SHOTS_PER_ATTACK);
      const portButtons = Array.from({ length: shotSlots }, (_, index) =>
        createActionButton(SIDE.PORT, index, shotSlots),
      );
      const moveButton = createMoveButton();
      const starButtons = Array.from({ length: shotSlots }, (_, index) =>
        createActionButton(SIDE.STARBOARD, index, shotSlots),
      );

      const portGroup = document.createElement("div");
      portGroup.className = `action-group ${SIDE.PORT}`;
      portButtons.forEach((button) => portGroup.appendChild(button));

      const starGroup = document.createElement("div");
      starGroup.className = `action-group ${SIDE.STARBOARD}`;
      starButtons.forEach((button) => starGroup.appendChild(button));

      row.appendChild(phaseLabel);
      row.appendChild(portGroup);
      row.appendChild(moveButton);
      row.appendChild(starGroup);

      const rowState = {
        move: MOVE.NONE,
        portActions: Array.from({ length: shotSlots }, () => ACTION_KIND.NONE),
        starActions: Array.from({ length: shotSlots }, () => ACTION_KIND.NONE),
        shotSlots,
        moveButton,
        portButtons,
        starButtons,
      };

      rowState.portButtons.forEach((button, index) =>
        updateActionButton(button, "Port", rowState.portActions[index]),
      );
      rowState.starButtons.forEach((button, index) =>
        updateActionButton(button, "Starboard", rowState.starActions[index]),
      );
      updateMoveButton(moveButton, rowState.move);

      // Keep a single action per side: grapple overrides fire.
      const updateSideButtons = (side) => {
        const actions = side === SIDE.PORT ? rowState.portActions : rowState.starActions;
        const buttons = side === SIDE.PORT ? rowState.portButtons : rowState.starButtons;
        const label = side === SIDE.PORT ? "Port" : "Starboard";
        buttons.forEach((button, index) => updateActionButton(button, label, actions[index]));
      };

      // Cycle actions for the selected side (1 shot -> 2 shots -> grapple -> none).
      const handleActionClick = (side) => {
        const actions = side === SIDE.PORT ? rowState.portActions : rowState.starActions;
        const currentMode = getSideMode(actions, rowState.shotSlots);
        const nextMode = nextSideMode(currentMode, rowState.shotSlots);
        applySideMode(actions, nextMode, rowState.shotSlots);

        updateSideButtons(SIDE.PORT);
        updateSideButtons(SIDE.STARBOARD);
      };

      rowState.portButtons.forEach((button) => {
        button.addEventListener("click", () => handleActionClick(SIDE.PORT));
      });

      rowState.starButtons.forEach((button) => {
        button.addEventListener("click", () => handleActionClick(SIDE.STARBOARD));
      });

      moveButton.addEventListener("click", () => {
        rowState.move = nextCycleValue(MOVE_CYCLE, rowState.move);
        updateMoveButton(moveButton, rowState.move);
      });

      rowsByShipId[ship.id].push({
        phaseIndex: phase,
        rowState,
      });
      stack.appendChild(row);
    }

    section.appendChild(stack);
    wrapper.appendChild(section);
  }

  rootElement.appendChild(wrapper);

  /** Convert a row UI state into a phase plan entry. */
  function rowToPlan(row) {
    const { move, portActions, starActions, shotSlots } = row.rowState;

    const buildSidePlan = (actions) => {
      const mode = getSideMode(actions, shotSlots);
      if (mode === ACTION_MODE.GRAPPLE) {
        return { kind: ACTION_KIND.GRAPPLE };
      }
      if (mode === ACTION_MODE.FIRE2) {
        return { kind: ACTION_KIND.FIRE, shots: Math.min(2, shotSlots) };
      }
      if (mode === ACTION_MODE.FIRE1) {
        return { kind: ACTION_KIND.FIRE, shots: 1 };
      }
      return { kind: ACTION_KIND.NONE };
    };

    return {
      move,
      port: buildSidePlan(portActions),
      starboard: buildSidePlan(starActions),
    };
  }

  /** Read the full plan for each ship. */
  function getPlans() {
    const plansByShipId = {};
    for (const [shipId, rows] of Object.entries(rowsByShipId)) {
      plansByShipId[shipId] = rows.map((row) => rowToPlan(row));
    }
    return plansByShipId;
  }

  /** Reset all UI buttons to default (empty) plans. */
  function clearPlans() {
    const defaults = createEmptyPlan();
    for (const rows of Object.values(rowsByShipId)) {
      rows.forEach((row, index) => {
        const desired = defaults[index];
        row.rowState.move = desired.move;
        row.rowState.portActions.fill(ACTION_KIND.NONE);
        row.rowState.starActions.fill(ACTION_KIND.NONE);
        updateMoveButton(row.rowState.moveButton, row.rowState.move);
        row.rowState.portButtons.forEach((button, slot) =>
          updateActionButton(button, "Port", row.rowState.portActions[slot]),
        );
        row.rowState.starButtons.forEach((button, slot) =>
          updateActionButton(button, "Starboard", row.rowState.starActions[slot]),
        );
      });
    }
  }

  /** Disable all planner buttons. */
  function setDisabled(disabled) {
    for (const rows of Object.values(rowsByShipId)) {
      for (const row of rows) {
        row.rowState.moveButton.disabled = disabled;
        row.rowState.portButtons.forEach((button) => {
          button.disabled = disabled;
        });
        row.rowState.starButtons.forEach((button) => {
          button.disabled = disabled;
        });
      }
    }
  }

  /** Disable a specific ship's planner buttons (used for AI). */
  function setShipDisabled(shipId, disabled) {
    const rows = rowsByShipId[shipId];
    if (!rows) {
      return;
    }
    for (const row of rows) {
      row.rowState.moveButton.disabled = disabled;
      row.rowState.portButtons.forEach((button) => {
        button.disabled = disabled;
      });
      row.rowState.starButtons.forEach((button) => {
        button.disabled = disabled;
      });
    }
  }

  /** Pre-fill planner UI with an existing plan. */
  function setPlans(shipId, plan) {
    const rows = rowsByShipId[shipId];
    if (!rows || !plan) {
      return;
    }
    rows.forEach((row, index) => {
      const entry = plan[index];
      if (!entry) {
        return;
      }
      row.rowState.move = entry.move || MOVE.NONE;
      row.rowState.portActions.fill(ACTION_KIND.NONE);
      row.rowState.starActions.fill(ACTION_KIND.NONE);
      const applySidePlan = (actions, sidePlan) => {
        if (!sidePlan || !sidePlan.kind || sidePlan.kind === ACTION_KIND.NONE) {
          return;
        }
        if (sidePlan.kind === ACTION_KIND.GRAPPLE) {
          actions[0] = ACTION_KIND.GRAPPLE;
          return;
        }
        if (sidePlan.kind === ACTION_KIND.FIRE) {
          const desiredShots = Math.max(1, Math.min(sidePlan.shots || 1, row.rowState.shotSlots));
          for (let i = 0; i < desiredShots; i += 1) {
            actions[i] = ACTION_KIND.FIRE;
          }
        }
      };

      if (entry.port || entry.starboard) {
        applySidePlan(row.rowState.portActions, entry.port);
        applySidePlan(row.rowState.starActions, entry.starboard);
      } else if (entry.action && entry.action !== ACTION.NONE) {
        const legacy = { kind: ACTION_KIND.NONE };
        if (entry.action === ACTION.SHOOT_PORT) {
          legacy.kind = ACTION_KIND.FIRE;
          legacy.shots = entry.shots || 1;
          applySidePlan(row.rowState.portActions, legacy);
        } else if (entry.action === ACTION.SHOOT_STARBOARD) {
          legacy.kind = ACTION_KIND.FIRE;
          legacy.shots = entry.shots || 1;
          applySidePlan(row.rowState.starActions, legacy);
        } else if (entry.action === ACTION.GRAPPLE_PORT) {
          legacy.kind = ACTION_KIND.GRAPPLE;
          applySidePlan(row.rowState.portActions, legacy);
        } else if (entry.action === ACTION.GRAPPLE_STARBOARD) {
          legacy.kind = ACTION_KIND.GRAPPLE;
          applySidePlan(row.rowState.starActions, legacy);
        }
      }
      updateMoveButton(row.rowState.moveButton, row.rowState.move);
      row.rowState.portButtons.forEach((button, slot) =>
        updateActionButton(button, "Port", row.rowState.portActions[slot]),
      );
      row.rowState.starButtons.forEach((button, slot) =>
        updateActionButton(button, "Starboard", row.rowState.starActions[slot]),
      );
    });
  }

  return {
    getPlans,
    clearPlans,
    setDisabled,
    setShipDisabled,
    setPlans,
  };
}
