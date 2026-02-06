/**
 * Update HUD text values without re-rendering the whole UI.
 * @param {{turnEl:HTMLElement,phaseEl:HTMLElement,timerEl:HTMLElement,stateEl:HTMLElement}} refs
 * @param {{turn?:number|string,phase?:number|string,timer?:number|string,state?:string}} values
 */
export function setHudText({ turnEl, phaseEl, timerEl, stateEl }, values) {
  if (typeof values.turn !== "undefined") {
    turnEl.textContent = String(values.turn);
  }
  if (typeof values.phase !== "undefined") {
    phaseEl.textContent = String(values.phase);
  }
  if (typeof values.timer !== "undefined") {
    timerEl.textContent = String(values.timer);
  }
  if (typeof values.state !== "undefined") {
    stateEl.textContent = String(values.state);
  }
}
