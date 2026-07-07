// Tipos y utilidades musicales para la app de solfeo.

export type ClefId = 'treble' | 'bass' | 'alto';

export interface ClefInfo {
  id: ClefId;
  nameEs: string;
  /** Notas (en notación VexFlow "c/4") cómodas para principiantes, dentro del pentagrama. */
  beginnerRange: string[];
}

export const CLEFS: Record<ClefId, ClefInfo> = {
  treble: {
    id: 'treble',
    nameEs: 'Clave de Sol',
    beginnerRange: [
      'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5', 'd/5', 'e/5',
      'f/5', 'g/5',
    ],
  },
  bass: {
    id: 'bass',
    nameEs: 'Clave de Fa',
    beginnerRange: [
      'e/2', 'f/2', 'g/2', 'a/2', 'b/2',
      'c/3', 'd/3', 'e/3', 'f/3', 'g/3',
      'a/3', 'b/3', 'c/4',
    ],
  },
  alto: {
    id: 'alto',
    nameEs: 'Clave de Do (en 3ª)',
    beginnerRange: [
      'f/3', 'g/3', 'a/3', 'b/3',
      'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5',
    ],
  },
};

/** Rango extendido (líneas adicionales) por clave. Se usa a partir del nivel 5. */
const EXTENDED_RANGE: Record<ClefId, string[]> = {
  treble: ['a/3', 'b/3', 'a/5', 'b/5', 'c/6', 'd/6'],
  bass: ['c/2', 'd/2', 'd/4', 'e/4', 'f/4'],
  alto: ['d/3', 'e/3', 'd/5', 'e/5'],
};

const NOTE_NAME_ES: Record<string, string> = {
  c: 'Do', d: 'Re', e: 'Mi', f: 'Fa', g: 'Sol', a: 'La', b: 'Si',
};

/** Índice cromático (0=C, ..., 11=B) admitiendo letras con # o b. */
const NOTE_CHROMATIC_INDEX: Record<string, number> = {
  c: 0, 'c#': 1, db: 1,
  d: 2, 'd#': 3, eb: 3,
  e: 4, fb: 4,
  f: 5, 'e#': 5,
  'f#': 6, gb: 6,
  g: 7, 'g#': 8, ab: 8,
  a: 9, 'a#': 10, bb: 10,
  b: 11, cb: 11,
};

/** Convierte una clave VexFlow ("c/4", "c#/4", "db/4") a número MIDI. */
export function vexKeyToMidi(key: string): number {
  const [letter, octaveStr] = key.split('/');
  const idx = NOTE_CHROMATIC_INDEX[letter.toLowerCase()] ?? 0;
  const octave = parseInt(octaveStr, 10);
  return (octave + 1) * 12 + idx;
}

/** Convierte una clave VexFlow a frecuencia en Hz (referencia A4 = 440 Hz). */
export function vexKeyToFrequency(key: string): number {
  const midi = vexKeyToMidi(key);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function letterAndAccidental(letter: string): { base: string; alt: '' | '#' | 'b' } {
  if (letter.length === 1) return { base: letter, alt: '' };
  const base = letter[0];
  const alt = letter[1] === '#' ? '#' : 'b';
  return { base, alt };
}

/** Devuelve el nombre en español, incluyendo alteración explícita y un becuadro si se indica. */
export function vexNoteToSpanish(key: string, accidental?: Accidental): string {
  const [letter, octave] = key.split('/');
  const { base, alt } = letterAndAccidental(letter);
  const nameEs = NOTE_NAME_ES[base.toLowerCase()] ?? base.toUpperCase();
  if (accidental === 'n') return `${nameEs}${octave} ♮`;
  const altSym = alt === '#' ? '♯' : alt === 'b' ? '♭' : '';
  return `${nameEs}${altSym}${octave}`;
}

export function vexNoteToEnglish(key: string, accidental?: Accidental): string {
  const [letter, octave] = key.split('/');
  const { base, alt } = letterAndAccidental(letter);
  if (accidental === 'n') return `${base.toUpperCase()}${octave} ♮`;
  const altSym = alt === '#' ? '♯' : alt === 'b' ? '♭' : '';
  return `${base.toUpperCase()}${altSym}${octave}`;
}

export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8';
export const TIME_SIGNATURES: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8'];

// =============================================================
// Tempos / velocidad de auto-avance
// =============================================================

export type TempoId = 'muyLento' | 'lento' | 'normal' | 'rapido' | 'muyRapido' | 'extremo';

export interface TempoPreset {
  id: TempoId;
  label: string;
  intervalMs: number;
}

export const TEMPOS: Record<TempoId, TempoPreset> = {
  muyLento: { id: 'muyLento', label: 'Muy lento', intervalMs: 6000 },
  lento: { id: 'lento', label: 'Lento', intervalMs: 4000 },
  normal: { id: 'normal', label: 'Normal', intervalMs: 2500 },
  rapido: { id: 'rapido', label: 'Rápido', intervalMs: 1500 },
  muyRapido: { id: 'muyRapido', label: 'Muy rápido', intervalMs: 900 },
  extremo: { id: 'extremo', label: 'Extremo', intervalMs: 500 },
};

export const TEMPO_ORDER: TempoId[] = [
  'muyLento', 'lento', 'normal', 'rapido', 'muyRapido', 'extremo',
];

// =============================================================
// Niveles de dificultad
// =============================================================

export interface LevelInfo {
  id: number;
  label: string;
  description: string;
}

export const NOTE_LEVELS: LevelInfo[] = [
  { id: 1, label: 'Nivel 1 · Naturales', description: 'Solo notas sin alteraciones.' },
  { id: 2, label: 'Nivel 2 · + Sostenidos (♯)', description: 'Aparecen notas con sostenido.' },
  { id: 3, label: 'Nivel 3 · + Bemoles (♭)', description: 'Aparecen también notas con bemol.' },
  { id: 4, label: 'Nivel 4 · + Becuadros (♮)', description: 'Se incluye el becuadro para reconocer el símbolo.' },
  { id: 5, label: 'Nivel 5 · + Líneas adicionales', description: 'Rango extendido con notas fuera del pentagrama.' },
];

export const RHYTHM_LEVELS: LevelInfo[] = [
  { id: 1, label: 'Nivel 1 · Figuras básicas', description: 'Redonda, blanca, negra y corchea.' },
  { id: 2, label: 'Nivel 2 · + Puntillos', description: 'Suma blanca y negra con puntillo.' },
  { id: 3, label: 'Nivel 3 · + Staccato', description: 'Aparece el punto de staccato (nota corta y separada) junto a la cabeza de la nota.' },
  { id: 4, label: 'Nivel 4 · + Ligaduras', description: 'Algunas figuras quedan unidas por ligadura.' },
  { id: 5, label: 'Nivel 5 · + Silencios', description: 'Aparecen silencios entre las figuras.' },
  { id: 6, label: 'Nivel 6 · + Semicorcheas', description: 'Se incluyen semicorcheas (figuras más rápidas).' },
];

export const MEASURE_COUNT_OPTIONS = [1, 2, 4, 8] as const;

export const MELODY_LEVELS: LevelInfo[] = [
  { id: 1, label: 'Nivel 1 · Notas y figuras simples', description: 'Notas naturales del pentagrama con negras y blancas.' },
  { id: 2, label: 'Nivel 2 · + Corcheas y redondas', description: 'Se añaden corcheas y figuras largas.' },
  { id: 3, label: 'Nivel 3 · + Puntillos', description: 'Aparecen blancas y negras con puntillo.' },
  { id: 4, label: 'Nivel 4 · + Ligaduras', description: 'Notas iguales unidas por ligadura.' },
  { id: 5, label: 'Nivel 5 · + Silencios', description: 'Se intercalan silencios entre las notas.' },
  { id: 6, label: 'Nivel 6 · + Alteraciones y semicorcheas', description: 'Sostenidos/bemoles ocasionales y figuras rápidas.' },
];

// =============================================================
// Generación de notas con alteración
// =============================================================

export type Accidental = '#' | 'b' | 'n';

export interface NoteExercise {
  /** Clave VexFlow (puede incluir alteración: "c/4", "c#/4", "db/4"). */
  key: string;
  /** Alteración a mostrar como modificador (necesario para becuadros, redundante para # y b). */
  accidental?: Accidental;
}

/** Combinaciones letra→sostenido/bemol que sí se usan comúnmente para principiantes. */
const SHARP_LETTERS = new Set(['c', 'd', 'f', 'g', 'a']); // C# D# F# G# A#
const FLAT_LETTERS = new Set(['d', 'e', 'g', 'a', 'b']); // Db Eb Gb Ab Bb

export function generateNoteExercise(clef: ClefId, level: number, previous?: string): NoteExercise {
  const base = [...CLEFS[clef].beginnerRange];
  if (level >= 5) base.push(...EXTENDED_RANGE[clef]);

  // Evitar repetir la misma nota dos veces seguidas
  let baseKey = pickRandom(base);
  let guard = 8;
  while (previous && baseKey === previous && guard-- > 0) baseKey = pickRandom(base);

  const [letter, octave] = baseKey.split('/');
  const choices: NoteExercise[] = [{ key: baseKey }];

  if (level >= 2 && SHARP_LETTERS.has(letter)) {
    choices.push({ key: `${letter}#/${octave}`, accidental: '#' });
  }
  if (level >= 3 && FLAT_LETTERS.has(letter)) {
    choices.push({ key: `${letter}b/${octave}`, accidental: 'b' });
  }
  if (level >= 4) {
    // Mostrar el becuadro como ejercicio de reconocimiento.
    choices.push({ key: baseKey, accidental: 'n' });
  }

  return pickRandom(choices);
}

// =============================================================
// Generación de compases con figuras
// =============================================================

export interface RhythmNote {
  /** Duración VexFlow: 'w' | 'h' | 'q' | '8' | '16' */
  duration: string;
  isRest: boolean;
  dotted?: boolean;
  /** Si esta nota está ligada (tie) con la siguiente. */
  tiedToNext?: boolean;
  /** Staccato: punto de articulación cerca de la cabeza de la nota. */
  staccato?: boolean;
}

interface PaletteEntry {
  duration: string;
  /** Duración en ticks de semicorchea (4 ticks = 1 semicorchea, 16 = negra, 64 = redonda). */
  ticks: number;
  dotted?: boolean;
}

/** Capacidad del compás en ticks (negra=16, blanca=32, redonda=64). 4/4 → 64 ticks. */
function measureCapacityTicks(timeSig: TimeSignature): number {
  const [num, den] = timeSig.split('/').map(Number);
  // num pulsos de 1/den de redonda → en ticks: num × (64/den)
  return Math.round((num * 64) / den);
}

function noteDurationTicks(duration: string, dotted?: boolean): number {
  const base: Record<string, number> = {
    w: 64,
    h: 32,
    q: 16,
    '8': 8,
    '16': 4,
  };
  const ticks = base[duration] ?? 16;
  return dotted ? Math.round(ticks * 1.5) : ticks;
}

function sumRhythmTicks(notes: Pick<RhythmNote, 'duration' | 'dotted'>[]): number {
  return notes.reduce((s, n) => s + noteDurationTicks(n.duration, n.dotted), 0);
}

/** Duración de una figura en negras (para audio y cursor). 1 = negra, 0.5 = corchea, etc. */
export function rhythmNoteBeats(n: Pick<RhythmNote, 'duration' | 'dotted'>): number {
  return noteDurationTicks(n.duration, n.dotted) / 16;
}

/** Duración total de un compás en negras (debe coincidir con el numerador en x/4). */
export function measureTotalBeats(timeSig: TimeSignature): number {
  return measureCapacityTicks(timeSig) / 16;
}

function buildPalette(timeSig: TimeSignature, level: number): PaletteEntry[] {
  const compound = timeSig === '6/8';
  const palette: PaletteEntry[] = compound
    ? [
        { duration: 'q', ticks: 16 }, // negra = 2 corcheas
        { duration: '8', ticks: 8 },
      ]
    : [
        { duration: 'w', ticks: 64 },
        { duration: 'h', ticks: 32 },
        { duration: 'q', ticks: 16 },
        { duration: '8', ticks: 8 },
      ];

  if (level >= 2 && !compound) {
    palette.push({ duration: 'h', ticks: 48, dotted: true });
    palette.push({ duration: 'q', ticks: 24, dotted: true });
  }
  if (level >= 6) {
    palette.push({ duration: '16', ticks: 4 });
  }
  return palette;
}

/** Garantiza que un compás rítmico sume exactamente la capacidad del compás. */
function normalizeRhythmMeasure(timeSig: TimeSignature, notes: RhythmNote[]): RhythmNote[] {
  const capacity = measureCapacityTicks(timeSig);
  let sum = sumRhythmTicks(notes);
  if (sum === capacity) return notes;

  const out = [...notes];
  if (sum > capacity) {
    while (out.length > 0 && sum > capacity) {
      const last = out.pop()!;
      sum -= noteDurationTicks(last.duration, last.dotted);
    }
  }
  if (sum < capacity) {
    for (const entry of fillRemainingTicks(capacity - sum)) {
      out.push({ duration: entry.duration, isRest: true });
    }
  }
  return out;
}

/** Garantiza que un compás melódico sume exactamente la capacidad del compás. */
function normalizeMelodyMeasure(timeSig: TimeSignature, notes: MelodyNote[]): MelodyNote[] {
  const capacity = measureCapacityTicks(timeSig);
  let sum = sumRhythmTicks(notes);
  if (sum === capacity) return notes;

  const out = [...notes];
  if (sum > capacity) {
    while (out.length > 0 && sum > capacity) {
      const last = out.pop()!;
      sum -= noteDurationTicks(last.duration, last.dotted);
    }
  }
  if (sum < capacity) {
    for (const entry of fillRemainingTicks(capacity - sum)) {
      out.push({ duration: entry.duration, isRest: true });
    }
  }
  return out;
}

/** Rellena exactamente los ticks restantes con negras, corcheas y semicorcheas. */
function fillRemainingTicks(remainingTicks: number): PaletteEntry[] {
  const fill: PaletteEntry[] = [];
  let r = remainingTicks;
  const steps: PaletteEntry[] = [
    { duration: 'q', ticks: 16 },
    { duration: '8', ticks: 8 },
    { duration: '16', ticks: 4 },
  ];
  while (r > 0) {
    const step = steps.find((s) => s.ticks <= r);
    if (!step) break;
    fill.push(step);
    r -= step.ticks;
  }
  return fill;
}

/**
 * Genera las figuras rítmicas de un compás que suman EXACTAMENTE la duración del compás.
 * Devuelve un array cuya suma de ticks coincide con measureCapacityTicks(timeSig).
 */
function generateRhythmPattern(timeSig: TimeSignature, level: number): RhythmNote[] {
  const capacity = measureCapacityTicks(timeSig);
  const palette = buildPalette(timeSig, level);
  const allowStaccato = level >= 3;
  const allowTies = level >= 4;
  const allowRests = level >= 5;

  const result: RhythmNote[] = [];
  let remaining = capacity;
  let guard = 64;

  while (remaining > 0 && guard-- > 0) {
    const candidates = palette.filter((p) => p.ticks <= remaining);
    if (candidates.length === 0) break;
    const pick = pickRandom(candidates);
    const isRest = allowRests && !pick.dotted && Math.random() < 0.18;
    const staccato =
      allowStaccato && !isRest && pick.duration !== 'w' && Math.random() < 0.32;
    result.push({
      duration: pick.duration,
      isRest,
      dotted: pick.dotted,
      staccato,
    });
    remaining -= pick.ticks;
  }

  // Rellenar el resto con figuras exactas (evita compases incompletos por redondeos).
  let sum = sumRhythmTicks(result);
  if (sum < capacity) {
    for (const entry of fillRemainingTicks(capacity - sum)) {
      result.push({ duration: entry.duration, isRest: false });
    }
  }

  // Ligaduras (nivel 4+):
  if (allowTies && result.length >= 2) {
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      if (a.isRest || b.isRest) continue;
      if (Math.random() < 0.22) {
        a.tiedToNext = true;
        a.staccato = false;
        b.staccato = false;
        i++;
      }
    }
  }

  return normalizeRhythmMeasure(timeSig, result);
}

/**
 * Genera un compás aleatorio según el nivel.
 * 1: w,h,q,8 · 2: + puntillos · 3: + staccato · 4: + ligaduras · 5: + silencios · 6: + 16
 */
export function generateMeasureByLevel(timeSig: TimeSignature, level: number): RhythmNote[] {
  return generateRhythmPattern(timeSig, level);
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function figureNameEs(n: RhythmNote): string {
  const map: Record<string, string> = {
    w: 'redonda', h: 'blanca', q: 'negra', '8': 'corchea', '16': 'semicorchea',
  };
  const name = map[n.duration] ?? n.duration;
  const dot = n.dotted ? ' c/p.' : '';
  const stacc = n.staccato ? ' ·stacc.' : '';
  const tie = n.tiedToNext ? ' ⌒' : '';
  return n.isRest ? `silencio de ${name}${dot}${tie}` : `${name}${dot}${stacc}${tie}`;
}

// =============================================================
// Generación de melodía (notas + ritmo combinados)
// =============================================================

export interface MelodyNote {
  /** Clave VexFlow (ej "c/4", "c#/4"). Indefinida cuando es silencio. */
  key?: string;
  /** Alteración explícita (necesaria para becuadros; redundante para # y b inline). */
  accidental?: Accidental;
  /** Duración VexFlow: 'w' | 'h' | 'q' | '8' | '16' */
  duration: string;
  isRest: boolean;
  dotted?: boolean;
  /** Ligadura con la siguiente nota (solo entre notas iguales). */
  tiedToNext?: boolean;
  staccato?: boolean;
}

/**
 * Genera un compás melódico (notas + ritmo) para el nivel dado.
 * Niveles:
 *  1: naturales · negra y blanca
 *  2: + corchea y redonda
 *  3: + puntillos
 *  4: + ligaduras (entre notas iguales)
 *  5: + silencios
 *  6: + alteraciones y semicorcheas
 */
export function generateMelodyByLevel(
  timeSig: TimeSignature,
  level: number,
  clef: ClefId,
): MelodyNote[] {
  const palette = buildPalette(timeSig, level);
  const capacity = measureCapacityTicks(timeSig);
  const allowTies = level >= 4;
  const allowRests = level >= 5;
  const allowAccidentals = level >= 6;

  const range = [...CLEFS[clef].beginnerRange];
  let prevIdx = Math.floor(Math.random() * range.length);

  const pickPitch = (): { key: string; accidental?: Accidental } => {
    const roll = Math.random();
    let nextIdx: number;
    if (roll < 0.55) {
      nextIdx = prevIdx + (Math.random() < 0.5 ? -1 : 1);
    } else if (roll < 0.85) {
      nextIdx = prevIdx + (Math.random() < 0.5 ? -2 : 2);
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      nextIdx = prevIdx + dir * (3 + Math.floor(Math.random() * 2));
    }
    nextIdx = Math.max(0, Math.min(range.length - 1, nextIdx));
    prevIdx = nextIdx;
    const baseKey = range[nextIdx];

    if (allowAccidentals && Math.random() < 0.18) {
      const [letter, octave] = baseKey.split('/');
      const sharpEligible = SHARP_LETTERS.has(letter);
      const flatEligible = FLAT_LETTERS.has(letter);
      if (sharpEligible && (!flatEligible || Math.random() < 0.5)) {
        return { key: `${letter}#/${octave}`, accidental: '#' };
      }
      if (flatEligible) {
        return { key: `${letter}b/${octave}`, accidental: 'b' };
      }
    }
    return { key: baseKey };
  };

  const notes: MelodyNote[] = [];
  let remaining = capacity;
  let guard = 64;

  while (remaining > 0 && guard-- > 0) {
    const candidates = palette.filter((p) => p.ticks <= remaining);
    if (candidates.length === 0) break;
    const pick = pickRandom(candidates);
    const isRest = allowRests && !pick.dotted && Math.random() < 0.15;
    const pitch = isRest ? null : pickPitch();
    notes.push({
      key: pitch?.key,
      accidental: pitch?.accidental,
      duration: pick.duration,
      isRest,
      dotted: pick.dotted,
    });
    remaining -= pick.ticks;
  }

  // Rellenar exactamente los ticks restantes.
  let sum = sumRhythmTicks(notes);
  if (sum < capacity) {
    for (const entry of fillRemainingTicks(capacity - sum)) {
      const p = pickPitch();
      notes.push({
        key: p.key,
        accidental: p.accidental,
        duration: entry.duration,
        isRest: false,
      });
    }
  }

  // Ligaduras solo entre notas iguales en afinación.
  if (allowTies && notes.length >= 2) {
    for (let i = 0; i < notes.length - 1; i++) {
      const a = notes[i];
      const b = notes[i + 1];
      if (a.isRest || b.isRest) continue;
      if (a.key !== b.key) continue;
      if (Math.random() < 0.3) {
        a.tiedToNext = true;
        i += 1;
      }
    }
  }

  return normalizeMelodyMeasure(timeSig, notes);
}

/** Genera N compases rítmicos independientes. */
export function generateRhythmMeasures(
  timeSig: TimeSignature,
  level: number,
  count: number,
): RhythmNote[][] {
  const n = Math.max(1, Math.floor(count));
  const out: RhythmNote[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(generateMeasureByLevel(timeSig, level));
  }
  return out;
}

/** Genera N compases melódicos independientes. */
export function generateMelodyMeasures(
  timeSig: TimeSignature,
  level: number,
  count: number,
  clef: ClefId,
): MelodyNote[][] {
  const n = Math.max(1, Math.floor(count));
  const out: MelodyNote[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(generateMelodyByLevel(timeSig, level, clef));
  }
  return out;
}

/** Resumen textual de una melodía: "Do (negra) · Re♯ (corchea) · …" */
export function melodySummaryEs(notes: MelodyNote[]): string {
  const figureMap: Record<string, string> = {
    w: 'redonda', h: 'blanca', q: 'negra', '8': 'corchea', '16': 'semicorchea',
  };
  return notes
    .map((n) => {
      const fig = figureMap[n.duration] ?? n.duration;
      const dot = n.dotted ? ' c/p.' : '';
      const tie = n.tiedToNext ? ' ⌒' : '';
      if (n.isRest) return `silencio (${fig}${dot})${tie}`;
      const noteName = n.key ? vexNoteToSpanish(n.key, n.accidental) : '?';
      return `${noteName} (${fig}${dot})${tie}`;
    })
    .join(' · ');
}
