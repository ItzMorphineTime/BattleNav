import { SIDE } from "./constants.js";

/** Unit grid step for each ship facing (screen y increases downward). */
export const DIRECTION_VECTORS = Object.freeze({
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
});

const PORT_DIRECTION = Object.freeze({
  N: "W",
  E: "N",
  S: "E",
  W: "S",
});

const STARBOARD_DIRECTION = Object.freeze({
  N: "E",
  E: "S",
  S: "W",
  W: "N",
});

/** Absolute facing after MOVE.TURN_LEFT (pivot + L leg), used for movement + animation. */
export const FACING_TURN_LEFT = Object.freeze({
  N: "W",
  W: "S",
  S: "E",
  E: "N",
});

/** Absolute facing after MOVE.TURN_RIGHT. */
export const FACING_TURN_RIGHT = Object.freeze({
  N: "E",
  E: "S",
  S: "W",
  W: "N",
});

/**
 * Cannon / grapple line-of-fire direction from ship facing and broadside.
 * @param {string} facing
 * @param {string} side SIDE.PORT | SIDE.STARBOARD
 */
export function sideDirection(facing, side) {
  return side === SIDE.PORT ? PORT_DIRECTION[facing] : STARBOARD_DIRECTION[facing];
}
