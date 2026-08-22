// Adapted from OpenReel's MIT-licensed master timeline clock design.
export class AssemblyPlaybackClock {
  constructor({ duration = 0, onTime, onState, requestFrame, cancelFrame, now } = {}) {
    this.duration = Math.max(0, Number(duration) || 0);
    this.onTime = typeof onTime === "function" ? onTime : () => {};
    this.onState = typeof onState === "function" ? onState : () => {};
    this.requestFrame = requestFrame || ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame = cancelFrame || ((id) => globalThis.cancelAnimationFrame(id));
    this.now = now || (() => globalThis.performance?.now?.() || Date.now());
    this.state = "paused";
    this.currentTime = 0;
    this.startedAt = 0;
    this.startedFrom = 0;
    this.frameId = null;
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;
  }

  setDuration(duration) {
    this.duration = Math.max(0, Number(duration) || 0);
    this.seek(this.currentTime);
  }

  setLoopRange(start, end, enabled = true) {
    const normalizedStart = Math.max(0, Number(start) || 0);
    const normalizedEnd = Math.max(0, Number(end) || 0);
    this.loopEnabled = Boolean(enabled && normalizedEnd > normalizedStart);
    this.loopStart = this.loopEnabled ? normalizedStart : 0;
    this.loopEnd = this.loopEnabled ? normalizedEnd : 0;
    return this.loopEnabled;
  }

  hasLoopRange() {
    return this.loopEnabled && this.loopEnd > this.loopStart;
  }

  seek(time) {
    let nextTime = Math.min(this.duration || Infinity, Math.max(0, Number(time) || 0));
    if (this.state === "playing" && this.hasLoopRange() && (nextTime < this.loopStart || nextTime >= this.loopEnd)) {
      nextTime = this.loopStart;
    }
    this.currentTime = nextTime;
    if (this.state === "playing") {
      this.startedAt = this.now();
      this.startedFrom = this.currentTime;
    }
    this.onTime(this.currentTime, this.state);
    return this.currentTime;
  }

  play() {
    if (this.state === "playing") return;
    let timeChanged = false;
    if (this.hasLoopRange() && (this.currentTime < this.loopStart || this.currentTime >= this.loopEnd)) {
      this.currentTime = this.loopStart;
      timeChanged = true;
    } else if (this.duration > 0 && this.currentTime >= this.duration) {
      this.currentTime = 0;
      timeChanged = true;
    }
    this.state = "playing";
    if (timeChanged) this.onTime(this.currentTime, this.state);
    this.startedAt = this.now();
    this.startedFrom = this.currentTime;
    this.onState(this.state);
    this.schedule();
  }

  pause() {
    if (this.state !== "playing") return;
    this.update(this.now());
    this.state = "paused";
    this.stopFrame();
    this.onState(this.state);
  }

  toggle() {
    if (this.state === "playing") this.pause();
    else this.play();
  }

  dispose() {
    this.stopFrame();
    this.state = "paused";
  }

  schedule() {
    if (this.frameId !== null || this.state !== "playing") return;
    this.frameId = this.requestFrame((timestamp) => {
      this.frameId = null;
      this.update(Number.isFinite(timestamp) ? timestamp : this.now());
      if (this.state === "playing") this.schedule();
    });
  }

  update(timestamp) {
    if (this.state !== "playing") return;
    this.currentTime = this.startedFrom + Math.max(0, timestamp - this.startedAt) / 1000;
    if (this.hasLoopRange() && (this.currentTime < this.loopStart || this.currentTime >= this.loopEnd)) {
      const span = this.loopEnd - this.loopStart;
      this.currentTime = this.currentTime < this.loopStart
        ? this.loopStart
        : this.loopStart + ((this.currentTime - this.loopStart) % span);
      this.startedAt = timestamp;
      this.startedFrom = this.currentTime;
      this.onTime(this.currentTime, this.state);
      return;
    }
    if (this.duration > 0 && this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.onTime(this.currentTime, this.state);
      this.state = "paused";
      this.stopFrame();
      this.onState(this.state);
      return;
    }
    this.onTime(this.currentTime, this.state);
  }

  stopFrame() {
    if (this.frameId === null) return;
    this.cancelFrame(this.frameId);
    this.frameId = null;
  }
}
