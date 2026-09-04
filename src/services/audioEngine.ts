import { EqualizerSettings } from '../types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // EQ Nodes
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;
  private cutoffFilter: BiquadFilterNode | null = null;

  // File audio playback
  private audioBuffer: AudioBuffer | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioMediaSource: MediaElementAudioSourceNode | null = null;

  // Synthesizer Scheduler for procedural tracks
  private synthIntervalId: number | null = null;
  private isSynthesizing = false;
  private synthStep = 0;
  private currentBpm = 120;
  private currentPreset: string = 'synthwave';

  // Playback state
  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private duration = 180;
  private volume = 0.8;
  private isMuted = false;
  private playbackRate = 1.0;

  // Listeners
  private onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private rafId: number | null = null;

  constructor() {
    // Lazy init audio context on first user gesture
  }

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      // Master Analyser
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Equalizer filters
      this.lowFilter = this.ctx.createBiquadFilter();
      this.lowFilter.type = 'lowshelf';
      this.lowFilter.frequency.value = 250;
      this.lowFilter.gain.value = 0;

      this.midFilter = this.ctx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1500;
      this.midFilter.Q.value = 1.0;
      this.midFilter.gain.value = 0;

      this.highFilter = this.ctx.createBiquadFilter();
      this.highFilter.type = 'highshelf';
      this.highFilter.frequency.value = 6000;
      this.highFilter.gain.value = 0;

      this.cutoffFilter = this.ctx.createBiquadFilter();
      this.cutoffFilter.type = 'lowpass';
      this.cutoffFilter.frequency.value = 20000;

      // Chain: Source -> Low -> Mid -> High -> Cutoff -> MasterGain -> Analyser -> Destination
      this.lowFilter.connect(this.midFilter);
      this.midFilter.connect(this.highFilter);
      this.highFilter.connect(this.cutoffFilter);
      this.cutoffFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setCallbacks(
    onTimeUpdate: (currentTime: number, duration: number) => void,
    onEnded: () => void
  ) {
    this.onTimeUpdateCallback = onTimeUpdate;
    this.onEndedCallback = onEnded;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64);
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public async loadTrack(
    preset: string = 'synthwave',
    duration: number = 180,
    bpm: number = 120,
    audioUrl?: string,
    audioBlob?: Blob
  ) {
    this.init();
    this.stop();

    this.duration = duration;
    this.currentBpm = bpm;
    this.currentPreset = preset;
    this.pauseOffset = 0;

    if (audioBlob) {
      const arrayBuffer = await audioBlob.arrayBuffer();
      if (this.ctx) {
        this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.duration = this.audioBuffer.duration;
      }
    } else if (audioUrl && audioUrl.startsWith('blob:')) {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        if (this.ctx) {
          this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.duration = this.audioBuffer.duration;
        }
      } catch {
        this.audioBuffer = null;
      }
    } else {
      this.audioBuffer = null;
    }
  }

  public play() {
    this.init();
    if (this.isPlaying) return;

    if (this.audioBuffer && this.ctx && this.lowFilter) {
      this.currentSource = this.ctx.createBufferSource();
      this.currentSource.buffer = this.audioBuffer;
      this.currentSource.playbackRate.value = this.playbackRate;
      this.currentSource.connect(this.lowFilter);
      this.startTime = this.ctx.currentTime - this.pauseOffset;
      this.currentSource.start(0, this.pauseOffset % this.duration);

      this.currentSource.onended = () => {
        if (this.isPlaying && this.getCurrentTime() >= this.duration - 0.5) {
          this.isPlaying = false;
          this.pauseOffset = 0;
          if (this.onEndedCallback) this.onEndedCallback();
        }
      };
    } else {
      // Procedural synthesizer mode
      this.isSynthesizing = true;
      this.startTime = (this.ctx ? this.ctx.currentTime : 0) - this.pauseOffset;
      this.startProceduralSynth();
    }

    this.isPlaying = true;
    this.startAnimationLoop();
  }

  public pause() {
    if (!this.isPlaying) return;

    this.pauseOffset = this.getCurrentTime();
    this.stopPlaybackNodes();
    this.isPlaying = false;
    this.stopAnimationLoop();
  }

  public stop() {
    this.stopPlaybackNodes();
    this.pauseOffset = 0;
    this.isPlaying = false;
    this.stopAnimationLoop();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0, this.duration);
    }
  }

  public seek(seconds: number) {
    const clampedTime = Math.max(0, Math.min(seconds, this.duration));
    const wasPlaying = this.isPlaying;

    if (this.isPlaying) {
      this.pause();
      this.pauseOffset = clampedTime;
      this.play();
    } else {
      this.pauseOffset = clampedTime;
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(clampedTime, this.duration);
      }
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.pauseOffset;
    }
    const elapsed = this.ctx.currentTime - this.startTime;
    return Math.min(elapsed, this.duration);
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.currentSource && this.ctx) {
      this.currentSource.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
    }
  }

  public applyEqualizer(settings: EqualizerSettings) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.lowFilter) {
      this.lowFilter.gain.setValueAtTime(settings.low + (settings.bassBoost ? 6 : 0), t);
    }
    if (this.midFilter) {
      this.midFilter.gain.setValueAtTime(settings.mid, t);
    }
    if (this.highFilter) {
      this.highFilter.gain.setValueAtTime(settings.high, t);
    }
    if (this.cutoffFilter) {
      this.cutoffFilter.frequency.setValueAtTime(settings.filterCutoff, t);
    }
  }

  private stopPlaybackNodes() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Source might already be stopped
      }
      this.currentSource = null;
    }

    if (this.synthIntervalId) {
      clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
    this.isSynthesizing = false;
  }

  private startAnimationLoop() {
    this.stopAnimationLoop();
    const update = () => {
      if (this.isPlaying) {
        const curTime = this.getCurrentTime();
        if (curTime >= this.duration) {
          this.pause();
          this.pauseOffset = 0;
          if (this.onEndedCallback) this.onEndedCallback();
          return;
        }
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(curTime, this.duration);
        }
        this.rafId = requestAnimationFrame(update);
      }
    };
    this.rafId = requestAnimationFrame(update);
  }

  private stopAnimationLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // --- PROCEDURAL SYNTHESIS ENGINE (High Quality Sound Generator) ---
  private startProceduralSynth() {
    if (this.synthIntervalId) clearInterval(this.synthIntervalId);

    const stepTimeMs = (60 / this.currentBpm / 4) * 1000; // 16th notes
    this.synthStep = Math.floor((this.pauseOffset / (60 / this.currentBpm / 4)) % 64);

    this.synthIntervalId = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.lowFilter) return;

      const step16 = this.synthStep % 16;
      const step64 = this.synthStep % 64;
      const time = this.ctx.currentTime + 0.02;

      this.triggerStepAudio(step16, step64, time);

      this.synthStep++;
    }, stepTimeMs);
  }

  private triggerStepAudio(step16: number, step64: number, time: number) {
    if (!this.ctx || !this.lowFilter) return;

    const preset = this.currentPreset;

    // Drum beats based on genre preset
    if (preset === 'lofi' || preset === 'chillhop') {
      // Lo-Fi Beat
      if (step16 === 0 || step16 === 7 || step16 === 10) this.playKick(time, 0.4, 60);
      if (step16 === 4 || step16 === 12) this.playSnare(time, 0.25, 1200);
      if (step16 % 2 === 0) this.playHiHat(time, 0.1, 0.03, step16 % 4 === 2);

      // Chords on bar steps
      if (step16 === 0) {
        const chordIndex = Math.floor(step64 / 16) % 4;
        const lofiChords = [
          [261.63, 311.13, 392.00, 466.16], // Cm7
          [220.00, 261.63, 329.63, 392.00], // Am7
          [174.61, 220.00, 261.63, 329.63], // Fmaj7
          [196.00, 246.94, 293.66, 349.23]  // G7
        ];
        this.playChord(lofiChords[chordIndex], time, 1.8, 'sine', 0.12);
        this.playBass(lofiChords[chordIndex][0] / 2, time, 1.2, 0.3);
      }
    } else if (preset === 'house' || preset === 'futurebass') {
      // 4-on-the-floor House
      if (step16 % 4 === 0) this.playKick(time, 0.6, 90);
      if (step16 === 4 || step16 === 12) this.playClap(time, 0.35);
      if (step16 % 2 === 1) this.playHiHat(time, 0.22, 0.08, true); // offbeat open hat

      // House bass groove
      if (step16 === 2 || step16 === 6 || step16 === 10 || step16 === 14) {
        const bassFreq = [130.81, 146.83, 110.00, 164.81][Math.floor(step64 / 16) % 4];
        this.playBass(bassFreq, time, 0.2, 0.4, 'sawtooth');
      }

      // Synth stab
      if (step16 === 3 || step16 === 7 || step16 === 11 || step16 === 14) {
        const houseChords = [
          [329.63, 392.00, 493.88, 587.33],
          [293.66, 369.99, 440.00, 523.25],
          [261.63, 329.63, 392.00, 493.88],
          [220.00, 277.18, 329.63, 415.30]
        ];
        this.playChord(houseChords[Math.floor(step64 / 16) % 4], time, 0.3, 'sawtooth', 0.1);
      }
    } else if (preset === 'ambient') {
      // Ambient atmospheric textures
      if (step16 === 0 && step64 % 32 === 0) {
        const ambientPads = [
          [130.81, 196.00, 246.94, 293.66, 392.00],
          [146.83, 220.00, 261.63, 329.63, 440.00],
          [110.00, 164.81, 220.00, 277.18, 329.63]
        ];
        this.playChord(ambientPads[Math.floor(step64 / 32) % 3], time, 4.0, 'sine', 0.18);
      }
      if (step16 % 8 === 0) {
        this.playLeadNote(523.25 + (step16 * 20), time, 1.2, 'sine', 0.08);
      }
    } else {
      // Cyberpunk / Synthwave default
      if (step16 === 0 || step16 === 8 || step16 === 10) this.playKick(time, 0.55, 80);
      if (step16 === 4 || step16 === 12) this.playSnare(time, 0.35, 1800);
      if (step16 % 2 === 0) this.playHiHat(time, 0.15, 0.04);

      // Running 16th note synthwave bassline
      const rootNotes = [65.41, 73.42, 55.00, 82.41]; // C2, D2, A1, E2
      const root = rootNotes[Math.floor(step64 / 16) % 4];
      const octMultiplier = (step16 % 4 === 0 || step16 % 4 === 2) ? 1 : 2;
      this.playBass(root * octMultiplier, time, 0.12, 0.28, 'sawtooth');

      // Arpeggiated synth melody
      const arpNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      const arpIndex = (step16 + Math.floor(step64 / 8)) % arpNotes.length;
      this.playLeadNote(arpNotes[arpIndex], time, 0.15, 'triangle', 0.12);
    }
  }

  // --- SYNTH INSTRUMENT HELPERS ---
  private playKick(time: number, volume: number = 0.5, startPitch: number = 80) {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startPitch * 2, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSnare(time: number, volume: number = 0.3, noiseCutoff: number = 1500) {
    if (!this.ctx || !this.lowFilter) return;
    // Noise component
    const bufferSize = this.ctx.sampleRate * 0.15;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = noiseCutoff;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.lowFilter);

    // Tonal snap
    const toneOsc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    toneOsc.type = 'triangle';
    toneOsc.frequency.setValueAtTime(180, time);
    toneOsc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

    toneGain.gain.setValueAtTime(volume * 0.7, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    toneOsc.connect(toneGain);
    toneGain.connect(this.lowFilter);

    whiteNoise.start(time);
    toneOsc.start(time);
    toneOsc.stop(time + 0.15);
  }

  private playClap(time: number, volume: number = 0.3) {
    if (!this.ctx || !this.lowFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;

    const gain = this.ctx.createGain();
    // 3 small bursts for handclap feel
    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.setValueAtTime(volume * 0.9, time + 0.015);
    gain.gain.setValueAtTime(volume, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    noise.start(time);
  }

  private playHiHat(time: number, volume: number = 0.15, decay: number = 0.04, open: boolean = false) {
    if (!this.ctx || !this.lowFilter) return;
    const bufferSize = this.ctx.sampleRate * (open ? 0.3 : 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.25 : decay));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    noise.start(time);
  }

  private playBass(freq: number, time: number, duration: number = 0.3, volume: number = 0.3, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private playChord(frequencies: number[], time: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) {
    if (!this.ctx || !this.lowFilter) return;
    frequencies.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(volume / frequencies.length, time + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.lowFilter!);

      osc.start(time);
      osc.stop(time + duration + 0.1);
    });
  }

  private playLeadNote(freq: number, time: number, duration: number, type: OscillatorType = 'triangle', volume: number = 0.12) {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // --- AUDIO FILE WAVEFORM EXTRACTION ---
  public static async extractWaveformDataFromBlob(blob: Blob, numBars: number = 80): Promise<{ waveform: number[]; duration: number }> {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;

    const blockSize = Math.floor(channelData.length / numBars);
    const waveform: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      const avg = sum / blockSize;
      // Normalize and boost for visual clarity (0.15 to 1.0)
      const normalized = Math.min(1.0, Math.max(0.15, avg * 3.5));
      waveform.push(Number(normalized.toFixed(3)));
    }

    tempCtx.close();
    return { waveform, duration };
  }
}

export const audioEngine = new SoundEngine();

