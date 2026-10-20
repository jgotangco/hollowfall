export type MusicMode = "title" | "explore" | "water" | "return" | "win";

const EXPLORE_LEAD = [
  74, 76, 79, 81, 83, 81, 79, 76, 74, 79, 81, 83, 81, 79, 76, 74, 71, 74, 76, 79, 81, 79, 76, 74, 76,
  74, 71, 69, 67, 69, 71, 74,
];
const EXPLORE_BASS = [
  43, 0, 0, 0, 38, 0, 43, 0, 43, 0, 41, 0, 38, 0, 36, 0, 43, 0, 0, 0, 38, 0, 40, 0, 35, 0, 38, 0, 43,
  0, 41, 0,
];
const WATER_LEAD = [
  62, 0, 67, 0, 69, 67, 65, 0, 62, 0, 65, 0, 69, 0, 67, 0, 60, 0, 65, 0, 67, 69, 67, 0, 65, 0, 62, 0,
  60, 0, 62, 0,
];
const WATER_BASS = [
  38, 0, 0, 0, 36, 0, 38, 0, 34, 0, 0, 0, 36, 0, 31, 0, 38, 0, 0, 0, 34, 0, 36, 0, 33, 0, 0, 0, 31,
  0, 38, 0,
];
const WIN_LEAD = [79, 83, 86, 91, 86, 83, 79, 74, 79, 83, 86, 91, 94, 91, 86, 83];
const WIN_BASS = [43, 0, 47, 0, 50, 0, 43, 0, 43, 0, 47, 0, 50, 0, 38, 0];

function midi(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private next = 0;
  private step = 0;
  private mode: MusicMode = "title";
  musicVol = 0.75;
  sfxVol = 0.85;
  muted = false;

  unlock() {
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 4200;
      this.music.connect(this.filter);
      this.filter.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.next = this.ctx.currentTime + 0.05;
      this.apply();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMode(mode: MusicMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (!this.ctx || !this.filter || !this.music) return;
    const water = mode === "water" || mode === "return";
    this.filter.frequency.setTargetAtTime(water ? 780 : 4600, this.ctx.currentTime, 0.12);
    const g = mode === "return" ? 0.35 : mode === "title" ? 0.7 : 1;
    this.music.gain.setTargetAtTime(g * this.curve(this.musicVol), this.ctx.currentTime, 0.08);
  }

  setMusic(v: number) {
    this.musicVol = v;
    this.apply();
  }

  setSfx(v: number) {
    this.sfxVol = v;
    this.apply();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.apply();
  }

  private curve(v: number): number {
    return v * v;
  }

  private apply() {
    if (!this.ctx || !this.master || !this.music || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.03);
    const mg = (this.mode === "return" ? 0.35 : this.mode === "title" ? 0.7 : 1) * this.curve(this.musicVol);
    this.music.gain.setTargetAtTime(mg, t, 0.03);
    this.sfx.gain.setTargetAtTime(this.curve(this.sfxVol), t, 0.03);
  }

  pump() {
    if (!this.ctx || !this.music) return;
    if (this.next < this.ctx.currentTime - 0.05) this.next = this.ctx.currentTime;
    const horizon = this.ctx.currentTime + 0.22;
    while (this.next < horizon) {
      this.schedule(this.step, this.next);
      const len = this.mode === "win" ? WIN_LEAD.length : EXPLORE_LEAD.length;
      this.step = (this.step + 1) % len;
      this.next += this.stepDur();
    }
  }

  private stepDur(): number {
    const bpm = this.mode === "water" ? 92 : this.mode === "title" ? 108 : this.mode === "win" ? 128 : 132;
    return 30 / bpm;
  }

  private schedule(step: number, time: number) {
    if (this.muted || this.mode === "return") return;
    const leadP = this.mode === "win" ? WIN_LEAD : this.mode === "water" ? WATER_LEAD : EXPLORE_LEAD;
    const bassP = this.mode === "win" ? WIN_BASS : this.mode === "water" ? WATER_BASS : EXPLORE_BASS;
    const lead = leadP[step % leadP.length] ?? 0;
    const bass = bassP[step % bassP.length] ?? 0;
    const dur = this.stepDur();
    if (lead) this.tone(time, midi(lead), dur * 0.92, "square", 0.055, "music");
    if (bass) this.tone(time, midi(bass), dur * 1.6, "triangle", 0.07, "music");
    if (step % 2 === 1) this.noiseBurst(time, 0.03, 1800, 0.03);
  }

  private tone(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    bus: "music" | "sfx",
    slideTo?: number,
  ) {
    if (!this.ctx || !this.music || !this.sfx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(bus === "music" ? this.music : this.sfx);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noiseBurst(time: number, dur: number, freq: number, gain: number) {
    if (!this.ctx || !this.noise || !this.sfx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(time);
    src.stop(time + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  jump() {
    const t = this.now();
    this.tone(t, 340, 0.09, "square", 0.07, "sfx", 140);
  }

  land() {
    this.noiseBurst(this.now(), 0.06, 240, 0.05);
  }

  gold() {
    const t = this.now();
    [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.055, f, 0.09, "square", 0.06, "sfx"));
  }

  relic() {
    const t = this.now();
    [392, 494, 587, 784, 988].forEach((f, i) => this.tone(t + i * 0.07, f, 0.16, "square", 0.07, "sfx"));
  }

  lantern() {
    const t = this.now();
    this.tone(t, 440, 0.1, "square", 0.06, "sfx");
    this.tone(t + 0.09, 660, 0.16, "square", 0.06, "sfx");
  }

  hurt() {
    const t = this.now();
    this.tone(t, 460, 0.38, "square", 0.08, "sfx", 70);
    this.noiseBurst(t, 0.22, 300, 0.08);
  }

  splash() {
    this.noiseBurst(this.now(), 0.14, 500, 0.07);
  }

  balloon() {
    this.tone(this.now(), 220, 0.18, "triangle", 0.07, "sfx", 440);
  }

  blip() {
    this.tone(this.now(), 880, 0.04, "square", 0.035, "sfx");
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
