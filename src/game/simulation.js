import { ACTION, ACTION_KIND, MOVE, PHASE_COUNT } from "./constants.js";
import { applyHazardsPhase } from "./hazards.js";
import { resolveCombatPhase } from "./rules-combat.js";
import { resolveMovementPhase } from "./rules-movement.js";
import { applyCombatResults } from "./rules-win.js";
import { cloneState } from "./state.js";

/** Normalize missing phase entries so the sim stays deterministic. */
function normalizePhasePlan(plan) {
  if (!plan) {
    return {
      move: MOVE.NONE,
      port: { kind: ACTION_KIND.NONE },
      starboard: { kind: ACTION_KIND.NONE },
    };
  }
  if (plan.port || plan.starboard) {
    return {
      move: plan.move || MOVE.NONE,
      port: plan.port || { kind: ACTION_KIND.NONE },
      starboard: plan.starboard || { kind: ACTION_KIND.NONE },
    };
  }
  const action = plan.action || ACTION.NONE;
  const sidePlan = { kind: ACTION_KIND.NONE };
  if (action === ACTION.SHOOT_PORT) {
    sidePlan.kind = ACTION_KIND.FIRE;
    sidePlan.shots = plan.shots;
    return { move: plan.move || MOVE.NONE, port: sidePlan, starboard: { kind: ACTION_KIND.NONE } };
  }
  if (action === ACTION.SHOOT_STARBOARD) {
    sidePlan.kind = ACTION_KIND.FIRE;
    sidePlan.shots = plan.shots;
    return { move: plan.move || MOVE.NONE, port: { kind: ACTION_KIND.NONE }, starboard: sidePlan };
  }
  if (action === ACTION.GRAPPLE_PORT) {
    sidePlan.kind = ACTION_KIND.GRAPPLE;
    return { move: plan.move || MOVE.NONE, port: sidePlan, starboard: { kind: ACTION_KIND.NONE } };
  }
  if (action === ACTION.GRAPPLE_STARBOARD) {
    sidePlan.kind = ACTION_KIND.GRAPPLE;
    return { move: plan.move || MOVE.NONE, port: { kind: ACTION_KIND.NONE }, starboard: sidePlan };
  }
  return {
    move: plan.move || MOVE.NONE,
    port: { kind: ACTION_KIND.NONE },
    starboard: { kind: ACTION_KIND.NONE },
  };
}

/** @param {Array<{alive:boolean}>} ships */
function activeShips(ships) {
  return ships.filter((ship) => ship.alive);
}

/**
 * Resolve an entire 4-phase turn using deterministic rules.
 * @param {import("./state.js").MatchState} matchState
 * @param {Record<string, Array<{move:string, port?:{kind:string, shots?:number}, starboard?:{kind:string, shots?:number}}>>} plansByShipId
 */
export function resolveTurn(matchState, plansByShipId) {
  const workingState = cloneState(matchState);
  const phaseResults = [];

  for (let phaseIndex = 0; phaseIndex < PHASE_COUNT; phaseIndex += 1) {
    if (activeShips(workingState.ships).length < 2) {
      break;
    }

    // Each phase reads the plan snapshot for every ship.
    const phasePlansByShipId = {};
    for (const ship of workingState.ships) {
      const shipPlan = plansByShipId[ship.id] || [];
      phasePlansByShipId[ship.id] = normalizePhasePlan(shipPlan[phaseIndex]);
    }

    // Movement -> hazards -> combat -> win check.
    const movement = resolveMovementPhase(workingState.ships, phasePlansByShipId, workingState.grid);
    const hazards = applyHazardsPhase(movement.ships, workingState.grid, phaseIndex);
    const combat = resolveCombatPhase(hazards.ships, phasePlansByShipId, workingState.grid);
    const win = applyCombatResults(hazards.ships, combat);

    workingState.ships = win.ships;

    if (win.outcome.winnerId || win.outcome.draw) {
      workingState.status = "finished";
      workingState.winnerId = win.outcome.winnerId;
      workingState.draw = win.outcome.draw;
    }

    phaseResults.push({
      phase: phaseIndex + 1,
      phasePlansByShipId,
      shipsAfterMovement: cloneState(movement.ships),
      shipsAfterHazards: cloneState(hazards.ships),
      shipsAfterPhase: cloneState(workingState.ships),
      traces: combat.traces,
      movementEvents: movement.events,
      hazardEvents: hazards.events,
      combatEvents: combat.events,
      resultEvents: win.events,
      outcome: win.outcome,
    });

    if (workingState.status === "finished") {
      break;
    }
  }

  if (workingState.status !== "finished") {
    workingState.status = "planning";
    workingState.phaseIndex = null;
    workingState.turnNumber += 1;
  }

  return {
    finalState: workingState,
    phaseResults,
  };
}
