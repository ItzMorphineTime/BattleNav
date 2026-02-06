/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Play each phase result with a fixed delay.
 * @param {Array<Object>} phaseResults
 * @param {{delayMs?:number,onPhase:(phase:Object)=>Promise<void>|void,onDone?:()=>void}} options
 */
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
