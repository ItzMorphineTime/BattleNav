import { ACTION, ACTION_KIND, MOVE } from "./constants.js";

/**
 * Normalize one phase plan so movement + port/starboard intents are always explicit.
 * Keeps legacy `{ action, shots }` shapes working.
 * @param {Object | null | undefined} plan
 * @returns {{ move: string, port: { kind: string, shots?: number }, starboard: { kind: string, shots?: number } }}
 */
export function normalizePhasePlan(plan) {
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
