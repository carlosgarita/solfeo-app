// Reproducción de ritmos y melodías con la Web Audio API.
//
// Diseño:
// - Un único AudioContext compartido (lazy).
// - `schedulePlayback` programa con precisión absoluta TODAS las notas y
//   silencios en el reloj de audio, devolviendo los tiempos para que el
//   componente visual pueda sincronizar el cursor con el sonido.
// - Las ligaduras (tiedToNext) unen varias figuras en un solo ataque sostenido.
// - Los silencios no suenan pero consumen tiempo en la línea.
// - Staccato => ataque corto (~40% de la duración nominal, máx 180 ms).
// - Cada PlayableNote puede llevar su propia frecuencia (Hz). Si no se da,
//   se usa A4 (440 Hz), útil para el ejercicio de ritmo puro.

/** Nota tocable (subset común de RhythmNote y MelodyNote). */
export interface PlayableNote {
  duration: string;
  isRest: boolean;
  dotted?: boolean;
  tiedToNext?: boolean;
  staccato?: boolean;
  /** Frecuencia en Hz; si se omite, suena A4 (440 Hz). */
  freq?: number;
}

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export interface PlayheadEvent {
  /** Beat en que comienza (0 = inicio del compás, antes está la cuenta atrás). */
  startBeat: number;
  /** Duración en beats. */
  durationBeats: number;
  /** Índice de la primera nota del grupo (las ligaduras agrupan varias). */
  noteIndex: number;
  isRest: boolean;
}

export interface PlaybackHandle {
  ctx: AudioContext;
  /** audioCtx.currentTime en que arrancan los primeros sonidos (cuenta atrás incluida). */
  startTime: number;
  /** audioCtx.currentTime en que comienza la música real (tras la cuenta atrás). */
  musicStartTime: number;
  /** Duración total de la música (sin contar la cuenta atrás), en segundos. */
  musicDurationSec: number;
  /** Duración total incluida la cuenta atrás. */
  totalDurationSec: number;
  /** Eventos (notas agrupadas por ligaduras) para sincronizar el cursor. */
  events: PlayheadEvent[];
  /** Detiene la reproducción y silencia todo. */
  stop: () => void;
}

interface ScheduleOptions {
  notes: PlayableNote[];
  /** Negras por minuto (siempre referido a la negra). */
  bpm: number;
  /** Número de clicks de cuenta atrás antes de empezar (0 = sin cuenta). */
  countIn: number;
  /** Compás (numerador). Se usa para acentuar el primer beat. */
  beatsPerMeasure: number;
  /** Llamada cuando termina toda la reproducción (o al detenerse). */
  onEnd: () => void;
}

interface LiveSource {
  osc: OscillatorNode;
  gain: GainNode;
  stopAt: number;
}

const BEATS_OF: Record<string, number> = {
  w: 4,
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
};

function beatsOf(n: PlayableNote): number {
  const base = BEATS_OF[n.duration] ?? 1;
  return n.dotted ? base * 1.5 : base;
}

export function schedulePlayback(opts: ScheduleOptions): PlaybackHandle {
  const { notes, bpm, countIn, beatsPerMeasure, onEnd } = opts;
  const ctx = getAudioContext();
  const beatSec = 60 / bpm;
  // Pequeño colchón para que el primer sonido no se "corte" por estar en el pasado.
  const startTime = ctx.currentTime + 0.08;

  const sources: LiveSource[] = [];

  // ----- Cuenta atrás -----
  for (let i = 0; i < countIn; i++) {
    const when = startTime + i * beatSec;
    const accented = i % Math.max(1, beatsPerMeasure) === 0;
    scheduleClick(ctx, when, accented, sources);
  }

  // ----- Eventos musicales -----
  const musicStartTime = startTime + countIn * beatSec;
  const events: PlayheadEvent[] = [];
  let cursorBeats = 0;
  let i = 0;
  while (i < notes.length) {
    const first = notes[i];
    const startBeat = cursorBeats;
    let totalBeats = beatsOf(first);
    const groupStartIndex = i;
    // Las ligaduras solo se agrupan si las notas tienen el mismo pitch (o ambas son
    // del ejercicio de ritmo puro, donde freq es undefined y se asume A4).
    while (
      i < notes.length - 1 &&
      notes[i].tiedToNext &&
      !notes[i].isRest &&
      !notes[i + 1].isRest &&
      notes[i].freq === notes[i + 1].freq
    ) {
      i += 1;
      totalBeats += beatsOf(notes[i]);
    }

    const isRest = first.isRest;
    const staccato = first.staccato;
    const durSec = totalBeats * beatSec;
    const when = musicStartTime + startBeat * beatSec;

    if (!isRest) {
      const playFor = staccato
        ? Math.min(durSec * 0.4, 0.18)
        : Math.max(0.06, durSec * 0.92);
      scheduleTone(ctx, when, playFor, first.freq ?? 440, sources);
    }

    events.push({
      startBeat,
      durationBeats: totalBeats,
      noteIndex: groupStartIndex,
      isRest,
    });

    cursorBeats += totalBeats;
    i += 1;
  }

  const musicDurationSec = cursorBeats * beatSec;
  const totalDurationSec = countIn * beatSec + musicDurationSec;

  let ended = false;
  const endTimer = window.setTimeout(() => {
    ended = true;
    onEnd();
  }, (totalDurationSec + 0.05) * 1000);

  const stop = () => {
    window.clearTimeout(endTimer);
    const now = ctx.currentTime;
    sources.forEach(({ osc, gain, stopAt }) => {
      if (stopAt <= now) return;
      try {
        gain.gain.cancelScheduledValues(now);
        const cur = gain.gain.value;
        gain.gain.setValueAtTime(cur, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.04);
        osc.stop(now + 0.05);
      } catch {
        // Ignorado: el nodo ya pudo haber terminado.
      }
    });
    if (!ended) {
      ended = true;
      onEnd();
    }
  };

  return {
    ctx,
    startTime,
    musicStartTime,
    musicDurationSec,
    totalDurationSec,
    events,
    stop,
  };
}

function scheduleClick(
  ctx: AudioContext,
  when: number,
  accented: boolean,
  sources: LiveSource[],
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accented ? 1600 : 1000, when);
  const peak = accented ? 0.18 : 0.12;
  const len = 0.07;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0008, when + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  const stopAt = when + len + 0.02;
  osc.stop(stopAt);
  sources.push({ osc, gain, stopAt });
}

function scheduleTone(
  ctx: AudioContext,
  when: number,
  durSec: number,
  freq: number,
  sources: LiveSource[],
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, when);

  const peak = 0.18;
  const attack = 0.012;
  const release = Math.min(0.08, durSec * 0.4);
  const sustainEnd = Math.max(when + attack + 0.005, when + durSec - release);

  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + attack);
  gain.gain.setValueAtTime(peak, sustainEnd);
  gain.gain.exponentialRampToValueAtTime(0.0008, when + durSec);

  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  const stopAt = when + durSec + 0.03;
  osc.stop(stopAt);
  sources.push({ osc, gain, stopAt });
}
