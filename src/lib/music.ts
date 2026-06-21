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
  units: number;
  dotted?: boolean;
}

/**
 * Genera un compás aleatorio según el nivel.
 * 1: w,h,q,8 · 2: + puntillos · 3: + staccato · 4: + ligaduras · 5: + silencios · 6: + 16
 */
export function generateMeasureByLevel(timeSig: TimeSignature, level: number): RhythmNote[] {
  const compound = timeSig === '6/8';
  const [num, den] = timeSig.split('/').map(Number);
  const total = compound ? 6 : num * (4 / den); // unidades en corcheas o negras

  const palette: PaletteEntry[] = compound
    ? [
        { duration: 'q', units: 2 },
        { duration: '8', units: 1 },
      ]
    : [
        { duration: 'w', units: 4 },
        { duration: 'h', units: 2 },
        { duration: 'q', units: 1 },
        { duration: '8', units: 0.5 },
      ];

  if (level >= 2 && !compound) {
    palette.push({ duration: 'h', units: 3, dotted: true }); // blanca con puntillo
    palette.push({ duration: 'q', units: 1.5, dotted: true }); // negra con puntillo
  }
  if (level >= 6) {
    palette.push({ duration: '16', units: compound ? 0.5 : 0.25 });
  }

  const allowStaccato = level >= 3;
  const allowTies = level >= 4;
  const allowRests = level >= 5;

  const result: RhythmNote[] = [];
  let remaining = total;
  let guard = 64;

  while (remaining > 0 && guard-- > 0) {
    const candidates = palette.filter((p) => p.units <= remaining + 1e-6);
    if (candidates.length === 0) break;
    const pick = pickRandom(candidates);
    const isRest = allowRests && !pick.dotted && Math.random() < 0.18;
    // Staccato en figuras cortas/medianas (no redonda, no silencio).
    const staccato =
      allowStaccato && !isRest && pick.duration !== 'w' && Math.random() < 0.32;
    result.push({
      duration: pick.duration,
      isRest,
      dotted: pick.dotted,
      staccato,
    });
    remaining -= pick.units;
  }

  // Rellenar restos con negras / corcheas
  while (remaining >= 1 - 1e-6) {
    result.push({ duration: 'q', isRest: false });
    remaining -= 1;
  }
  if (remaining >= 0.5 - 1e-6) {
    result.push({ duration: '8', isRest: false });
    remaining -= 0.5;
  }
  if (remaining >= 0.25 - 1e-6) {
    result.push({ duration: '16', isRest: false });
  }

  // Ligaduras (nivel 4+): unir pares adyacentes; al ligar quitamos el staccato del primero
  // (no tiene sentido musical un staccato sobre una nota ligada).
  if (allowTies && result.length >= 2) {
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      if (a.isRest || b.isRest) continue;
      if (Math.random() < 0.22) {
        a.tiedToNext = true;
        a.staccato = false;
        b.staccato = false;
        i++; // evitar encadenar 3 seguidas
      }
    }
  }

  return result;
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
