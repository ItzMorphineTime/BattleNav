export function applyHazardsPhase(ships) {
  return {
    ships: ships.map((ship) => ({ ...ship })),
    events: [],
  };
}
