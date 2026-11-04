// Renders the two in-house Wave Dash soundtrack loops as MP3s:
//   public/assets/audio/menu-music.mp3  — 84 BPM chill menu loop
//   public/assets/audio/game-music.mp3  — 145 BPM intense in-game loop (NCS-style)
// Run with: node scripts/generate-music.mjs   (needs ffmpeg on PATH)
// Deterministic: fixed seeds, no network, no dependencies. Re-run to regenerate byte-stable output.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const AUDIO_DIR = path.join(ROOT, "public", "assets", "audio");
const SR = 44100;
const TAU = Math.PI * 2;

/* ---------------- utils ---------------- */

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/* ---------------- stereo bus ---------------- */

class Bus {
  constructor(seconds) {
    this.n = Math.round(seconds * SR);
    this.l = new Float32Array(this.n);
    this.r = new Float32Array(this.n);
  }
  addMono(buf, pan = 0, gain = 1, at = 0) {
    // equal-power panning
    const p = (pan + 1) / 2;
    const gl = gain * Math.cos(p * (Math.PI / 2));
    const gr = gain * Math.sin(p * (Math.PI / 2));
    const start = Math.round(at * SR);
    const end = Math.min(this.n, start + buf.length);
    for (let i = Math.max(0, -start); start + i < end; i++) {
      const j = start + i;
      this.l[j] += buf[i] * gl;
      this.r[j] += buf[i] * gr;
    }
  }
  addBus(other, gain = 1) {
    for (let i = 0; i < Math.min(this.n, other.n); i++) {
      this.l[i] += other.l[i] * gain;
      this.r[i] += other.r[i] * gain;
    }
  }
  duck(kickTimes, depth, rate) {
    // sidechain pump: music dips right when each kick hits
    for (const t of kickTimes) {
      const s = Math.round(t * SR);
      const tail = Math.round((4 / rate) * SR);
      for (let i = 0; i < tail; i++) {
        const j = s + i;
        if (j < 0 || j >= this.n) continue;
        const g = 1 - depth * Math.exp(-(i / SR) * rate);
        this.l[j] *= g;
        this.r[j] *= g;
      }
    }
  }
}

/* ---------------- voice helper ---------------- */

function voice(opt) {
  const {
    f, d, type = "saw",
    attack = 0.004, decay = 0.2, sustain = 0, release = 0.05,
    cutoff = 0, detune = 0, vib = 0, vibHz = 5,
    g = 1,
  } = opt;
  const rel = Math.max(0.002, release);
  const atk = Math.max(3 / SR, attack);
  const dc = Math.max(0.0005, decay);
  const n = Math.ceil((d + rel) * SR);
  const out = new Float32Array(n);
  const lpf = cutoff > 0;
  const alpha = lpf ? 1 - Math.exp((-TAU * cutoff) / SR) : 0;
  const dA = Math.pow(2, detune / 1200), dB = Math.pow(2, -detune / 1200);
  let phase = 0, phase2 = 0, lpY = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fr1 = f * dA * (1 + (vib ? vib * Math.sin(TAU * vibHz * t) : 0));
    const fr2 = f * dB * (1 - (vib ? vib * Math.sin(TAU * vibHz * t) : 0));
    phase = (phase + fr1 / SR) % 1;
    phase2 = (phase2 + fr2 / SR) % 1;
    let x = osclike(type, phase);
    if (detune !== 0) x = (x + osclike(type, phase2)) * 0.5;
    if (lpf) { lpY += alpha * (x - lpY); x = lpY; }
    // envelope
    let e;
    if (t < atk) e = t / atk;
    else if (t < d) e = sustain + (1 - sustain) * Math.exp(-(t - atk) / dc);
    else e = (sustain + (1 - sustain) * Math.exp(-(d - atk) / dc)) * Math.exp(-(t - d) / rel);
    out[i] = x * e * g;
  }
  return out;
}

function osclike(type, ph) {
  switch (type) {
    case "sine": return Math.sin(TAU * ph);
    case "tri": return 4 * Math.abs(ph - 0.5) - 1;
    case "saw": return 2 * ph - 1;
    case "square": return ph < 0.5 ? -1 : 1;
    default: return Math.sin(TAU * ph);
  }
}

/* ---------------- drum kit ---------------- */

function kickBuf(d = 0.3, punch = 1) {
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(101);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 46 + 118 * Math.exp(-t * 20);
    ph += f / SR;
    const body = Math.sin(TAU * ph) * Math.exp(-t * 9);
    const click = (rng() * 2 - 1) * Math.exp(-t * 420) * 0.45;
    out[i] = (body * 0.95 + click * punch) * punch;
  }
  return out;
}

function snareBuf(d = 0.22) {
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(202);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += 194 / SR;
    const tone = Math.sin(TAU * ph) * Math.exp(-t * 22) * 0.55;
    const x = rng() * 2 - 1;
    lp += 0.35 * (x - lp);
    const crunch = x - lp; // crude band emphasis
    out[i] = tone + crunch * Math.exp(-t * 26) * 1.1;
  }
  return out;
}

function clapBuf(d = 0.25) {
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(303);
  let lp = 0;
  const bursts = [0, 0.012, 0.024, 0.04];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rng() * 2 - 1;
    lp += 0.3 * (x - lp);
    let env = 0;
    for (let b = 0; b < bursts.length; b++) {
      const tb = t - bursts[b];
      if (tb >= 0) env = Math.max(env, (b === bursts.length - 1 ? Math.exp(-tb * 16) : Math.exp(-tb * 90)));
    }
    out[i] = (x - lp * 0.6) * env;
  }
  return out;
}

function hatBuf(open = false) {
  const d = open ? 0.24 : 0.06;
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(open ? 404 : 505);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rng() * 2 - 1;
    lp += 0.09 * (x - lp);
    out[i] = (x - lp) * Math.exp(-t * (open ? 13 : 55));
  }
  for (let i = 0; i < n; i++) out[i] *= 0.55;
  return out;
}

function crashBuf(d = 1.6) {
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(606);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rng() * 2 - 1;
    lp += 0.24 * (x - lp);
    out[i] = (x - lp * 0.5) * Math.exp(-t * 3.2) * 0.7;
  }
  return out;
}

function riserBuf(d = 2, seed = 7) {
  const n = Math.ceil(d * SR);
  const out = new Float32Array(n);
  const rng = mulberry32(900 + seed);
  let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const t = i / SR;
    const f = 240 + 900 * p * p;
    ph += f / SR;
    const x = rng() * 2 - 1;
    lp += (0.03 + 0.42 * p) * (x - lp);
    const sweep = Math.sin(TAU * ph) * 0.4;
    out[i] = ((x - lp) * 0.8 + sweep) * Math.pow(p, 2) * 0.9;
  }
  return out;
}

/* ---------------- post ---------------- */

function softClip(bus, drive) {
  const norm = Math.tanh(drive);
  for (let i = 0; i < bus.n; i++) {
    bus.l[i] = Math.tanh(bus.l[i] * drive) / norm;
    bus.r[i] = Math.tanh(bus.r[i] * drive) / norm;
  }
}

function finalize(bus, peakTarget, loopFades = 0.006) {
  softClip(bus, bus.drive || 1.3);
  let peak = 0;
  for (let i = 0; i < bus.n; i++) {
    peak = Math.max(peak, Math.abs(bus.l[i]), Math.abs(bus.r[i]));
  }
  const k = peak > 0 ? peakTarget / peak : 1;
  for (let i = 0; i < bus.n; i++) { bus.l[i] *= k; bus.r[i] *= k; }
  // loop declick: tiny fades at the seam so <audio loop> never clicks
  const fl = Math.round(loopFades * SR);
  for (let i = 0; i < fl; i++) {
    const g = i / fl;
    bus.l[i] *= g; bus.r[i] *= g;
    const j = bus.n - fl + i;
    bus.l[j] *= (1 - i / fl); bus.r[j] *= (1 - i / fl);
  }
  return bus;
}

function writeWav(file, L, R) {
  const n = L.length;
  const dataLen = n * 4;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) {
    let a = Math.max(-1, Math.min(1, L[i]));
    let b = Math.max(-1, Math.min(1, R[i]));
    buf.writeInt16LE(Math.round(a * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(b * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}

function toMp3(wav, mp3, title) {
  const r = spawnSync(
    process.env.FFMPEG || "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", wav,
      "-c:a", "libmp3lame", "-b:a", "192k",
      "-metadata", `title=${title}`,
      "-metadata", "album=Wave Dash OST",
      "-metadata", "comment=Original in-house composition, royalty-free",
      mp3,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr || "").trim()}`);
}

/* ---------------- track 1: chill menu loop ---------------- */

function buildMenu() {
  const BPM = 84;
  const beat = 60 / BPM;
  const bar = beat * 4;
  const BARS = 16;
  const total = bar * BARS + beat / 8;
  const music = new Bus(total);
  const drums = new Bus(total);
  const rnd = mulberry32(1101);

  // Am — F — C — G, one chord per 2 bars
  const CH = [
    [57, 60, 64, 69], // Am
    [53, 57, 60, 65], // F
    [55, 60, 64, 67], // C
    [55, 59, 62, 67], // G
  ];
  const ROOT = [45, 41, 36, 43]; // A2 F2 C2 G2

  for (let barIdx = 0; barIdx < BARS; barIdx++) {
    const ci = Math.floor(barIdx / 2) % 4;
    const chord = CH[ci];
    const t0 = barIdx * bar;

    // pad: detuned saws, slow attack, warm lowpass
    for (const note of chord) {
      music.addMono(voice({ f: hz(note), d: bar * 1.98, type: "saw", attack: 0.55, decay: 0.4, sustain: 0.85, release: 0.7, cutoff: 1000, detune: 7, g: 0.085 }), -0.12, 1, t0);
    }
    // sub pad shimmer on top note
    music.addMono(voice({ f: hz(chord[3] + 12), d: bar * 1.96, type: "tri", attack: 0.9, decay: 0.3, sustain: 0.7, release: 0.8, cutoff: 2200, g: 0.05 }), 0.28, 1, t0);

    // bass: root notes, laid back
    music.addMono(voice({ f: hz(ROOT[ci]), d: beat * 1.9, type: "sine", attack: 0.01, decay: 0.6, sustain: 0.55, release: 0.18, g: 0.34 }), 0, 1, t0);
    music.addMono(voice({ f: hz(ROOT[ci]), d: beat * 1.2, type: "sine", attack: 0.01, decay: 0.6, sustain: 0.55, release: 0.18, g: 0.3 }), 0, 1, t0 + beat * 2);
    music.addMono(voice({ f: hz(ROOT[ci] + 12), d: beat * 0.36, type: "tri", attack: 0.006, decay: 0.35, sustain: 0, release: 0.06, cutoff: 900, g: 0.16 }), 0.1, 1, t0 + beat * 3.5);

    // arp: plucky triangle 8ths with dotted-eighth echo
    const seq = [0, 1, 2, 3, 2, 1, 3, 2];
    for (let k = 0; k < 8; k++) {
      const note = chord[seq[k]] + (k % 3 === 2 ? 12 : 0);
      const t = t0 + k * (beat / 2);
      const v = voice({ f: hz(note), d: beat * 0.4, type: "tri", attack: 0.004, decay: 0.22, sustain: 0, release: 0.05, cutoff: 3800, g: 0.1 * (0.85 + rnd() * 0.3) });
      music.addMono(v, 0.2, 1, t);
      music.addMono(v, 0.24, 0.38, t + beat * 0.75); // echo tap 1
      music.addMono(v, 0.26, 0.15, t + beat * 1.5);  // echo tap 2
    }

    // drums: soft kick 1&3, rim 2&4, airy 8th hats with 16th shimmer
    const kickTimes = [t0, t0 + beat * 2];
    for (const kt of kickTimes) drums.addMono(kickBuf(0.3, 0.7), 0, 0.5, kt);
    for (const st of [1, 3]) drums.addMono(snareBuf(0.22), 0.05, 0.26, t0 + beat * st);
    for (let e = 0; e < 8; e++) {
      if (e % 2 === 1) drums.addMono(hatBuf(false), 0.3, 0.14 + rnd() * 0.05, t0 + e * (beat / 2));
    }
    for (let s = 0; s < 16; s++) {
      drums.addMono(hatBuf(false), -0.25, 0.045 + rnd() * 0.05, t0 + s * (beat / 4));
    }

    music.duck(kickTimes, 0.28, 8);
  }

  const mix = new Bus(total);
  mix.addBus(music, 1);
  mix.addBus(drums, 1);
  return finalize(mix, 0.88, 0.008);
}

/* ---------------- track 2: intense game loop ---------------- */

function buildGame() {
  const BPM = 145;
  const beat = 60 / BPM;
  const bar = beat * 4;
  const BARS = 32;
  const six = beat / 4; // 16th
  const total = bar * BARS + six * 2;
  const music = new Bus(total);
  const drums = new Bus(total);
  const rnd = mulberry32(2202);

  const ROOT = [40, 36, 43, 38]; // E2 C2 G2 D2
  const STAB = [
    [64, 67, 71, 76], // Em
    [60, 64, 67, 72], // C
    [59, 62, 67, 74], // G
    [62, 66, 69, 74], // D
  ];

  const kickTimes = [];
  for (let barIdx = 0; barIdx < BARS; barIdx++) {
    const ci = barIdx % 4;
    const root = ROOT[ci];
    const chord = STAB[ci];
    const t0 = barIdx * bar;
    const intro = barIdx < 4;
    const late = barIdx >= 16;

    for (let b = 0; b < 4; b++) {
      const kt = t0 + b * beat;
      kickTimes.push(kt);
      drums.addMono(kickBuf(0.3, 1), 0, 0.85, kt);
      drums.addMono(snareBuf(0.2), 0.02, 0.42, t0 + beat * 1);
      drums.addMono(clapBuf(0.24), -0.05, 0.4, t0 + beat * 3);
    }

    // rolling 8th bass (saw body + square grit)
    for (let e = 0; e < 8; e++) {
      const note = root + (e % 2 === 1 ? 12 : 0);
      const acc = e % 2 === 0 ? 1 : 0.82;
      const t = t0 + e * (beat / 2);
      music.addMono(voice({ f: hz(note), d: six * 1.9, type: "saw", attack: 0.004, decay: 0.14, sustain: 0.3, release: 0.05, cutoff: 1250, g: 0.17 * acc }), 0, 1, t);
      music.addMono(voice({ f: hz(note), d: six * 1.9, type: "square", attack: 0.004, decay: 0.1, sustain: 0.2, release: 0.04, cutoff: 700, g: 0.07 * acc }), 0, 1, t);
    }

    // offbeat saw stabs (the pump)
    if (!intro) {
      for (const pos of [2, 6, 10, 14]) {
        const t = t0 + pos * six;
        const pan = pos % 12 === 2 ? -0.2 : 0.2;
        for (const note of chord) {
          music.addMono(voice({ f: hz(note), d: six * 1.4, type: "saw", attack: 0.003, decay: 0.05, sustain: 0.25, release: 0.07, cutoff: 2400, detune: 5, g: 0.052 }), pan, 1, t);
        }
      }
      // long lift chord on bar downbeats every 4 bars
      if (barIdx % 4 === 0) {
        for (const note of chord) {
          music.addMono(voice({ f: hz(note + 12), d: beat * 2.2, type: "saw", attack: 0.06, decay: 0.5, sustain: 0.6, release: 0.4, cutoff: 1600, detune: 8, g: 0.06 }), -0.15, 1, t0);
        }
      }
    }

    // hats: driving 16ths + offbeat opens once past the intro
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * six;
      const accent = s % 4 === 2 ? 1.25 : 1;
      drums.addMono(hatBuf(false), 0.25, (0.14 + rnd() * 0.06) * accent, t);
    }
    if (!intro) {
      for (let b = 0; b < 4; b++) {
        drums.addMono(hatBuf(true), -0.28, 0.2, t0 + b * beat + six * 2);
      }
    }

    // lead arp from the halfway point — 16th saw cycle + echo
    if (late) {
      const seq = [0, 1, 2, 3];
      for (let s = 0; s < 16; s++) {
        const note = chord[seq[(s + barIdx) % 4]] + 24 + (s % 8 === 5 ? 12 : 0);
        const t = t0 + s * six;
        const v = voice({ f: hz(note), d: six * 1.5, type: "saw", attack: 0.002, decay: 0.06, sustain: 0, release: 0.05, cutoff: 5200, detune: 4, g: 0.055 * (0.8 + rnd() * 0.4) });
        music.addMono(v, 0.26, 1, t);
        music.addMono(v, 0.3, 0.34, t + six * 3);
        music.addMono(v, 0.34, 0.12, t + six * 6);
      }
    }

    // crashes at section turns
    if (barIdx === 0 || barIdx === 16) drums.addMono(crashBuf(1.7), -0.1, 0.32, t0);
    // riser into section 2 and back around the loop
    if (barIdx === 14 || barIdx === 30) music.addMono(riserBuf(bar * 2, barIdx), 0, 0.4, t0);

    music.duck(kickTimes.filter((kt) => kt >= t0 && kt < t0 + bar), 0.55, 7.5);
  }

  const mix = new Bus(total);
  mix.addBus(music, 1);
  mix.addBus(drums, 1);
  mix.drive = 1.7;
  return finalize(mix, 0.94, 0.006);
}

/* ---------------- main ---------------- */

function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), "wavedash-audio-"));
  try {
    const jobs = [
      { render: buildMenu, file: "menu-music.mp3", title: "Wave Dash — Menu (Chill Loop)", seed: "1101" },
      { render: buildGame, file: "game-music.mp3", title: "Wave Dash — Run (Intense Loop)", seed: "2202" },
    ];
    for (const job of jobs) {
      const bus = job.render();
      const wav = path.join(tmp, job.file.replace(".mp3", ".wav"));
      writeWav(wav, bus.l, bus.r);
      const mp3 = path.join(AUDIO_DIR, job.file);
      toMp3(wav, mp3, job.title);
      console.log(`built ${mp3} — ${(bus.n / SR).toFixed(2)}s, peak-normalized`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
