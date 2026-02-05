function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function playPhaseResults(phaseResults, options) {
  const delayMs = options.delayMs || 750;
  for (const phaseResult of phaseResults) {
    await options.onPhase(phaseResult);
    await sleep(delayMs);
  }
  if (options.onDone) {
    options.onDone();
  }
}
