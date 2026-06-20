// 程序化音效合成系统 - 使用Web Audio API

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private bgmInterval: number | null = null;
  private enabled = true;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.3;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? 0.5 : 0;
    }
  }

  // 通用音调播放
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.5,
    attack = 0.01,
    release = 0.1,
  ) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + release);
  }

  // 频率扫描音
  private playSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "sawtooth",
    volume = 0.4,
  ) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFreq),
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  // 噪音音效
  private playNoise(duration: number, volume = 0.3, filterFreq = 1000) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + duration);
  }

  // === SFX ===
  sfxLaneChange() {
    this.playSweep(800, 1200, 0.15, "sine", 0.3);
  }

  sfxJump() {
    this.playSweep(300, 800, 0.4, "sine", 0.4);
  }

  sfxSlide() {
    this.playNoise(0.6, 0.2, 2000);
  }

  sfxCrash() {
    this.playNoise(1.2, 0.5, 300);
    this.playSweep(400, 50, 1.0, "sawtooth", 0.3);
  }

  sfxCoin() {
    this.playTone(1200, 0.08, "sine", 0.3);
    setTimeout(() => this.playTone(1600, 0.08, "sine", 0.3), 50);
  }

  sfxJetpack() {
    this.playSweep(100, 400, 0.8, "sawtooth", 0.3);
    this.playNoise(0.8, 0.2, 500);
  }

  sfxComboUp(combo: number) {
    const baseFreq = 400 + combo * 30;
    this.playTone(baseFreq, 0.15, "triangle", 0.3);
  }

  sfxComboBreak() {
    this.playSweep(600, 100, 0.4, "sawtooth", 0.3);
  }

  sfxPerfectDodge() {
    this.playSweep(200, 50, 0.8, "sine", 0.5);
    this.playTone(80, 0.8, "sine", 0.4);
  }

  sfxLotterySpin() {
    this.playTone(100, 0.1, "square", 0.2);
  }

  sfxLotteryOpen() {
    this.playNoise(0.8, 0.4, 800);
    this.playSweep(100, 1000, 0.6, "sawtooth", 0.3);
  }

  sfxLegendary() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.4, "triangle", 0.4), i * 100);
    });
  }

  sfxClick() {
    this.playTone(1000, 0.05, "sine", 0.2);
  }

  sfxPopup() {
    this.playSweep(400, 800, 0.2, "sine", 0.2);
  }

  sfxPowerUp() {
    this.playSweep(200, 600, 0.4, "triangle", 0.3);
  }

  sfxError() {
    this.playTone(200, 0.15, "sawtooth", 0.2);
    setTimeout(() => this.playTone(150, 0.2, "sawtooth", 0.2), 100);
  }

  // === BGM ===
  startBGM(mode: "menu" | "play" | "result") {
    this.stopBGM();
    if (!this.ctx || !this.bgmGain || !this.enabled) return;

    const bpm = mode === "play" ? 160 : mode === "menu" ? 90 : 80;
    const beatDuration = 60 / bpm;

    // 基础贝斯线
    const bassNotes =
      mode === "play"
        ? [55, 55, 82, 73] // D&B 贝斯
        : mode === "menu"
          ? [110, 138, 165, 138] // Synthwave
          : [82, 98, 110, 98]; // 结算

    let beat = 0;
    this.bgmInterval = window.setInterval(
      () => {
        if (!this.ctx || !this.bgmGain) return;
        const now = this.ctx.currentTime;
        const note = bassNotes[beat % bassNotes.length];

        // 贝斯
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = "sawtooth";
        bassOsc.frequency.value = note;
        bassGain.gain.setValueAtTime(0.15, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + beatDuration * 0.8);
        bassOsc.connect(bassGain);
        bassGain.connect(this.bgmGain);
        bassOsc.start(now);
        bassOsc.stop(now + beatDuration);

        // 鼓点
        if (beat % 2 === 0) {
          this.playNoise(0.05, 0.15, 100);
        }
        // 高音点缀
        if (mode === "play" && beat % 4 === 2) {
          const leadOsc = this.ctx!.createOscillator();
          const leadGain = this.ctx!.createGain();
          leadOsc.type = "square";
          leadOsc.frequency.value = note * 4;
          leadGain.gain.setValueAtTime(0.05, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          leadOsc.connect(leadGain);
          leadGain.connect(this.bgmGain!);
          leadOsc.start(now);
          leadOsc.stop(now + 0.2);
        }

        beat++;
      },
      beatDuration * 1000,
    );
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmNodes.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        // 已停止
      }
    });
    this.bgmNodes = [];
  }
}

export const audio = new AudioSystem();
