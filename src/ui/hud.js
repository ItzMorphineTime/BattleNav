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
