/**
 * Simple countdown timer used during planning.
 */
export class TurnTimer {
  /**
   * @param {number} durationSeconds
   * @param {(remaining:number)=>void} onTick
   * @param {() => void} onDone
   */
  constructor(durationSeconds, onTick, onDone) {
    this.durationSeconds = durationSeconds;
    this.onTick = onTick;
    this.onDone = onDone;
    this.intervalId = null;
    this.remaining = durationSeconds;
  }

  /** Start a fresh countdown. */
  start() {
    this.stop();
    this.remaining = this.durationSeconds;
    this.onTick(this.remaining);

    this.intervalId = setInterval(() => {
      this.remaining -= 1;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onDone();
      }
    }, 1000);
  }

  /** Stop the countdown if it is running. */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
