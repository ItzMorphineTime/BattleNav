export class TurnTimer {
  constructor(durationSeconds, onTick, onDone) {
    this.durationSeconds = durationSeconds;
    this.onTick = onTick;
    this.onDone = onDone;
    this.intervalId = null;
    this.remaining = durationSeconds;
  }

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

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
