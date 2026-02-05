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
const ACTION_CYCLE = [ACTION_KIND.NONE, ACTION_KIND.FIRE, ACTION_KIND.GRAPPLE];

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

function nextCycleValue(list, current) {
  const index = list.indexOf(current);
  if (index === -1) {
    return list[0];
  }
  return list[(index + 1) % list.length];
}

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

function createMoveButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-tile";
  button.dataset.move = MOVE.NONE;
  button.title = MOVE_LABELS[MOVE.NONE];
  return button;
}

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

function updateMoveButton(button, move) {
  button.dataset.move = move;
  button.title = `Move: ${MOVE_LABELS[move] || MOVE_LABELS[MOVE.NONE]}`;
}

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

      const updateSideButtons = (side) => {
        const actions = side === SIDE.PORT ? rowState.portActions : rowState.starActions;
        const buttons = side === SIDE.PORT ? rowState.portButtons : rowState.starButtons;
        const label = side === SIDE.PORT ? "Port" : "Starboard";
        buttons.forEach((button, index) => updateActionButton(button, label, actions[index]));
      };

      const clearSide = (side) => {
        const actions = side === SIDE.PORT ? rowState.portActions : rowState.starActions;
        actions.fill(ACTION_KIND.NONE);
      };

      const handleActionClick = (side, index) => {
        const actions = side === SIDE.PORT ? rowState.portActions : rowState.starActions;
        const otherActions = side === SIDE.PORT ? rowState.starActions : rowState.portActions;
        const next = nextCycleValue(ACTION_CYCLE, actions[index]);

        if (next === ACTION_KIND.GRAPPLE) {
          actions.fill(ACTION_KIND.NONE);
          actions[index] = ACTION_KIND.GRAPPLE;
          otherActions.fill(ACTION_KIND.NONE);
        } else if (next === ACTION_KIND.FIRE) {
          if (actions.includes(ACTION_KIND.GRAPPLE)) {
            actions.fill(ACTION_KIND.NONE);
          }
          actions[index] = ACTION_KIND.FIRE;
          if (otherActions.some((value) => value !== ACTION_KIND.NONE)) {
            otherActions.fill(ACTION_KIND.NONE);
          }
        } else {
          actions[index] = ACTION_KIND.NONE;
        }

        updateSideButtons(SIDE.PORT);
        updateSideButtons(SIDE.STARBOARD);
      };

      rowState.portButtons.forEach((button, index) => {
        button.addEventListener("click", () => handleActionClick(SIDE.PORT, index));
      });

      rowState.starButtons.forEach((button, index) => {
        button.addEventListener("click", () => handleActionClick(SIDE.STARBOARD, index));
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

  function rowToPlan(row) {
    const { move, portActions, starActions } = row.rowState;
    let action = ACTION.NONE;
    let shots = undefined;
    const portGrapple = portActions.includes(ACTION_KIND.GRAPPLE);
    const starGrapple = starActions.includes(ACTION_KIND.GRAPPLE);
    const portShots = portActions.filter((value) => value === ACTION_KIND.FIRE).length;
    const starShots = starActions.filter((value) => value === ACTION_KIND.FIRE).length;

    if (portGrapple) {
      action = ACTION.GRAPPLE_PORT;
    } else if (starGrapple) {
      action = ACTION.GRAPPLE_STARBOARD;
    } else if (portShots > 0) {
      action = ACTION.SHOOT_PORT;
      shots = portShots;
    } else if (starShots > 0) {
      action = ACTION.SHOOT_STARBOARD;
      shots = starShots;
    }
    return shots ? { move, action, shots } : { move, action };
  }

  function getPlans() {
    const plansByShipId = {};
    for (const [shipId, rows] of Object.entries(rowsByShipId)) {
      plansByShipId[shipId] = rows.map((row) => rowToPlan(row));
    }
    return plansByShipId;
  }

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
      if (entry.action && entry.action !== ACTION.NONE) {
        const desiredShots =
          entry.action === ACTION.SHOOT_PORT || entry.action === ACTION.SHOOT_STARBOARD
            ? Math.max(1, Math.min(entry.shots || row.rowState.shotSlots, row.rowState.shotSlots))
            : 1;
        if (entry.action === ACTION.SHOOT_PORT) {
          for (let i = 0; i < desiredShots; i += 1) {
            row.rowState.portActions[i] = ACTION_KIND.FIRE;
          }
        } else if (entry.action === ACTION.SHOOT_STARBOARD) {
          for (let i = 0; i < desiredShots; i += 1) {
            row.rowState.starActions[i] = ACTION_KIND.FIRE;
          }
        } else if (entry.action === ACTION.GRAPPLE_PORT) {
          row.rowState.portActions[0] = ACTION_KIND.GRAPPLE;
        } else if (entry.action === ACTION.GRAPPLE_STARBOARD) {
          row.rowState.starActions[0] = ACTION_KIND.GRAPPLE;
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
