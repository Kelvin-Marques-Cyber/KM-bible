/** Original synthesized notes, no downloaded samples. Audio starts only on a user gesture. */
export class CampaignAudio {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private saga = 0;
  private generation = 0;
  async enable(): Promise<boolean> {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) return false;
    try {
      this.context ??= new Context();
      await this.context.resume();
      return this.context.state === "running";
    } catch {
      return false;
    }
  }
  private note(
    frequency: number,
    delay: number,
    duration: number,
    volume: number,
    wave: OscillatorType = "triangle",
  ) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const now = context.currentTime + delay,
      oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }
  setActive(active: boolean, saga = 0) {
    this.saga = saga;
    const generation = ++this.generation;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!this.context) return;
    if (!active) {
      void this.context.suspend().catch(() => {});
      return;
    }
    void this.context
      .resume()
      .then(() => {
        if (
          generation !== this.generation ||
          !this.context ||
          this.context.state !== "running"
        )
          return;
        const play = () => {
          const notes = [0, 7, 12, 9, 4, 7, 2, 9],
            root = 130.81 * Math.pow(2, this.saga / 12);
          this.note(
            root * Math.pow(2, notes[this.step++ % notes.length] / 12),
            0,
            2.1,
            0.025,
          );
          if (this.step % 4 === 0) this.note(root / 2, 0.1, 3, 0.012, "sine");
        };
        play();
        this.timer = setInterval(play, 1700);
      })
      .catch(() => {});
  }
  cue(kind: "discovery" | "wrong" | "victory") {
    if (kind === "discovery") {
      for (const [i, n] of [0, 7, 12].entries())
        this.note(261.63 * Math.pow(2, n / 12), i * 0.09, 0.45, 0.035);
    }
    if (kind === "wrong") this.note(174.61, 0, 0.25, 0.025, "sine");
    if (kind === "victory") {
      for (const [i, n] of [0, 4, 7, 12, 16, 19].entries())
        this.note(196 * Math.pow(2, n / 12), i * 0.12, 1, 0.03);
    }
  }
  close() {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => {});
  }
}
