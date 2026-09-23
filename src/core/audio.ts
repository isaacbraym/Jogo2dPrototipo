/**
 * Áudio 100% sintetizado via WebAudio: efeitos e uma trilha ambiente generativa.
 * Nenhum arquivo externo é necessário.
 */
type OscType = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private reverb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  musicOn = true;
  sfxOn = true;
  private musicTimer: number | null = null;
  private chordIdx = 0;
  private mood: 'calm' | 'happy' | 'sad' | 'tense' = 'calm';

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('viva.audio') || '{}');
      if (typeof saved.music === 'boolean') this.musicOn = saved.music;
      if (typeof saved.sfx === 'boolean') this.sfxOn = saved.sfx;
    } catch {
      /* armazenamento indisponível */
    }
  }

  private persist() {
    try {
      localStorage.setItem('viva.audio', JSON.stringify({ music: this.musicOn, sfx: this.sfxOn }));
    } catch {
      /* ignore */
    }
  }

  /** Deve ser chamado a partir de um gesto do usuário. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.22 : 0;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb).connect(wet).connect(this.master);
    const sfxWet = ctx.createGain();
    sfxWet.gain.value = 0.18;
    this.sfxBus.connect(this.reverb);
    this.reverb.connect(sfxWet).connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  private makeImpulse(sec: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    return buf;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.persist();
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.3);
  }
  setSfx(on: boolean) {
    this.sfxOn = on;
    this.persist();
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }
  setMood(m: 'calm' | 'happy' | 'sad' | 'tense') {
    this.mood = m;
  }

  // ---------- primitivas ----------
  private tone(freq: number, dur: number, opts: { type?: OscType; vol?: number; slide?: number; delay?: number; attack?: number; bus?: AudioNode; detune?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
    const vol = opts.vol ?? 0.3;
    const at = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, opts: { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; delay?: number; sweep?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- efeitos ----------
  click() { this.tone(900, 0.06, { type: 'triangle', vol: 0.18, slide: 0.6 }); }
  hover() { this.tone(1400, 0.035, { type: 'sine', vol: 0.05 }); }
  pop() { this.tone(520, 0.12, { type: 'sine', vol: 0.3, slide: 2.2 }); }
  tick() { this.tone(1800, 0.03, { type: 'square', vol: 0.03 }); }
  whoosh() { this.noise(0.35, { vol: 0.22, freq: 400, sweep: 3000, q: 0.7 }); }
  swoosh() { this.noise(0.22, { vol: 0.14, freq: 2400, sweep: 600, q: 0.8 }); }
  step() { this.noise(0.05, { vol: 0.05, freq: 300, type: 'lowpass' }); }
  chime() {
    [0, 4, 7, 12].forEach((s, i) => this.tone(660 * Math.pow(2, s / 12), 0.9, { type: 'sine', vol: 0.16, delay: i * 0.07 }));
  }
  success() {
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.06 }));
  }
  fail() {
    this.tone(300, 0.35, { type: 'sawtooth', vol: 0.08, slide: 0.5 });
    this.tone(220, 0.5, { type: 'triangle', vol: 0.14, slide: 0.6, delay: 0.15 });
  }
  hit() {
    this.tone(160, 0.18, { type: 'sine', vol: 0.5, slide: 0.35 });
    this.noise(0.12, { vol: 0.4, freq: 900, q: 0.6 });
  }
  slap() {
    this.noise(0.08, { vol: 0.5, freq: 2600, q: 0.5 });
  }
  kiss() {
    this.tone(1200, 0.08, { type: 'sine', vol: 0.18, slide: 1.8 });
    this.noise(0.05, { vol: 0.1, freq: 4000, q: 2, delay: 0.03 });
  }
  heart() {
    this.tone(880, 0.25, { type: 'sine', vol: 0.12, slide: 1.3 });
    this.tone(1320, 0.3, { type: 'sine', vol: 0.08, delay: 0.08 });
  }
  coin() {
    this.tone(1318, 0.08, { type: 'square', vol: 0.06 });
    this.tone(1976, 0.3, { type: 'square', vol: 0.06, delay: 0.07 });
  }
  cash() {
    for (let i = 0; i < 6; i++) this.tone(1500 + Math.random() * 900, 0.15, { type: 'triangle', vol: 0.07, delay: i * 0.06 });
  }
  cheer() {
    this.noise(1.6, { vol: 0.18, freq: 1500, q: 0.4 });
    this.noise(1.2, { vol: 0.1, freq: 3000, q: 0.6, delay: 0.1 });
  }
  applause() {
    for (let i = 0; i < 22; i++) this.noise(0.05, { vol: 0.12, freq: 1800 + Math.random() * 1500, q: 1.5, delay: i * 0.07 + Math.random() * 0.05 });
  }
  boing() { this.tone(200, 0.4, { type: 'sine', vol: 0.3, slide: 3 }); }
  thud() {
    this.tone(90, 0.3, { type: 'sine', vol: 0.5, slide: 0.5 });
    this.noise(0.15, { vol: 0.2, freq: 200, type: 'lowpass' });
  }
  sparkle() {
    for (let i = 0; i < 5; i++) this.tone(2000 + i * 300, 0.25, { type: 'sine', vol: 0.05, delay: i * 0.05 });
  }
  sad() {
    [0, -3, -7].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), 0.8, { type: 'triangle', vol: 0.12, delay: i * 0.25 }));
  }
  siren() {
    for (let i = 0; i < 4; i++) {
      this.tone(700, 0.3, { type: 'square', vol: 0.04, slide: 1.4, delay: i * 0.6 });
      this.tone(980, 0.3, { type: 'square', vol: 0.04, slide: 0.7, delay: i * 0.6 + 0.3 });
    }
  }
  heartbeat() {
    this.tone(60, 0.15, { type: 'sine', vol: 0.5, slide: 0.7 });
    this.tone(55, 0.15, { type: 'sine', vol: 0.35, slide: 0.7, delay: 0.2 });
  }
  levelUp() {
    [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.05 }));
  }
  talk() {
    this.tone(260 + Math.random() * 180, 0.05, { type: 'triangle', vol: 0.05 });
  }
  gavel() {
    this.tone(180, 0.1, { type: 'square', vol: 0.12, slide: 0.5 });
    this.noise(0.08, { vol: 0.4, freq: 1000, q: 1 });
  }
  camera() {
    this.noise(0.05, { vol: 0.3, freq: 3000, q: 0.5 });
    this.noise(0.08, { vol: 0.2, freq: 1500, q: 0.5, delay: 0.08 });
  }
  splash() { this.noise(0.6, { vol: 0.25, freq: 800, sweep: 300, q: 0.5 }); }
  fire() { this.noise(1.5, { vol: 0.12, freq: 500, q: 0.3, type: 'lowpass' }); }
  magic() {
    for (let i = 0; i < 8; i++) this.tone(800 + i * 150, 0.4, { type: 'sine', vol: 0.05, delay: i * 0.04 });
  }
  bell() {
    this.tone(1046, 1.8, { type: 'sine', vol: 0.15 });
    this.tone(2093, 1.2, { type: 'sine', vol: 0.05 });
  }
  engine() { this.tone(70, 1.2, { type: 'sawtooth', vol: 0.06, slide: 2.2 }); }
  cry() {
    this.tone(500, 0.5, { type: 'sine', vol: 0.06, slide: 0.7 });
    this.tone(480, 0.6, { type: 'sine', vol: 0.05, slide: 0.65, delay: 0.55 });
  }
  laugh() {
    for (let i = 0; i < 4; i++) this.tone(330 - i * 12, 0.09, { type: 'triangle', vol: 0.07, delay: i * 0.12 });
  }

  // ---------- trilha generativa ----------
  private startMusic() {
    if (this.musicTimer) return;
    const progs: Record<string, number[][]> = {
      calm: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]],
      happy: [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [0, 4, 7, 11]],
      sad: [[9, 12, 16, 19], [5, 9, 12, 16], [0, 4, 7, 12], [7, 11, 14, 17]],
      tense: [[2, 5, 9, 12], [0, 3, 7, 10], [2, 5, 8, 12], [0, 3, 7, 10]],
    };
    const base = 196; // Sol
    const play = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      const prog = progs[this.mood];
      const chord = prog[this.chordIdx % prog.length];
      this.chordIdx++;
      const dur = 4.2;
      if (this.musicOn) {
        chord.forEach((s, i) => {
          this.tone(base * Math.pow(2, s / 12), dur + 0.8, { type: i % 2 ? 'triangle' : 'sine', vol: 0.05, attack: 1.2, bus: this.musicBus, detune: (Math.random() - 0.5) * 8 });
        });
        this.tone((base / 2) * Math.pow(2, chord[0] / 12), dur, { type: 'sine', vol: 0.07, attack: 0.4, bus: this.musicBus });
        // arpejo delicado
        for (let k = 0; k < 6; k++) {
          if (Math.random() < 0.72) {
            const s = chord[Math.floor(Math.random() * chord.length)] + 12 * (Math.random() < 0.5 ? 1 : 2);
            this.tone(base * Math.pow(2, s / 12), 0.9, { type: 'sine', vol: 0.025, delay: k * 0.7 + Math.random() * 0.05, bus: this.musicBus });
          }
        }
      }
      this.musicTimer = window.setTimeout(play, dur * 1000);
    };
    play();
  }
}

export const sfx = new AudioEngine();
