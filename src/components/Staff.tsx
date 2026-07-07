import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  Articulation,
  Barline,
  Dot,
  Modifier,
  StaveTie,
} from 'vexflow';
import type {
  Accidental as AccidentalSym,
  ClefId,
  MelodyNote,
  RhythmNote,
  TimeSignature,
} from '../lib/music';

export interface StaffLayout {
  width: number;
  height: number;
  /** Posición X (px) donde el cursor entra a la zona musical (después de la clave/compás). */
  contentStartX: number;
  /** Posición del ataque de cada nota (en orden de lectura). */
  notePositions: { x: number; y: number }[];
  /** Para cada fila del pentagrama: la X del borde derecho del último compás y su Y. */
  rowEndsX: { x: number; y: number }[];
  /** Altura visible del pentagrama en píxeles (para dimensionar el cursor). */
  rowHeight: number;
}

export interface PlayheadPosition {
  x: number;
  y: number;
  /** Altura opcional. Si se omite, se usa la que se dio en el layout. */
  height?: number;
}

export interface StaffHandle {
  /** Mueve el cursor (playhead) a la posición 2D dada. `null` lo oculta. */
  setPlayhead: (pos: PlayheadPosition | null) => void;
}

interface StaffProps {
  clef: ClefId;
  pianoGrand: boolean;
  timeSig: TimeSignature;
  mode: 'note' | 'rhythm' | 'melody';
  /** Modo nota: clave VexFlow (ej. "c/4"). */
  noteKey?: string;
  /** Alteración explícita (necesaria para becuadros; redundante para # y b). */
  noteAccidental?: AccidentalSym;
  /** Modo ritmo: array de compases. */
  rhythmMeasures?: RhythmNote[][];
  rhythmNoteKey?: string;
  /** Modo melodía: array de compases. */
  melodyMeasures?: MelodyNote[][];
  onLayout?: (layout: StaffLayout) => void;
}

const VEX_CLEF: Record<ClefId, 'treble' | 'bass' | 'alto'> = {
  treble: 'treble',
  bass: 'bass',
  alto: 'alto',
};

const MIN_STAVE_WIDTH = 220;
const MAX_STAVE_WIDTH = 560;
const STAVE_HEIGHT = 120;
const ROW_GAP = 24;
/** Ancho mínimo para un compás legible (sin la clave). */
const MIN_MEASURE_WIDTH = 150;
/** Espacio extra reservado en la primera fila para clave + signatura de compás. */
const FIRST_ROW_CLEF_EXTRA = 60;
/** Espacio extra reservado al inicio de cada fila posterior para la clave. */
const OTHER_ROW_CLEF_EXTRA = 40;

export const Staff = forwardRef<StaffHandle, StaffProps>(function Staff(
  {
    clef,
    pianoGrand,
    timeSig,
    mode,
    noteKey,
    noteAccidental,
    rhythmMeasures,
    rhythmNoteKey,
    melodyMeasures,
    onLayout,
  },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(MAX_STAVE_WIDTH);

  useImperativeHandle(
    ref,
    () => ({
      setPlayhead(pos: PlayheadPosition | null) {
        const el = playheadRef.current;
        if (!el) return;
        if (pos == null) {
          el.style.opacity = '0';
        } else {
          el.style.opacity = '1';
          el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
          if (pos.height != null) el.style.height = `${pos.height}px`;
        }
      },
    }),
    [],
  );

  // Observa el ancho del padre (.score-card) y actualiza containerWidth.
  useEffect(() => {
    const host = wrapperRef.current;
    if (!host) return;
    const parent = host.parentElement ?? host;
    const update = () => {
      const cs = window.getComputedStyle(parent);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const inner = parent.clientWidth - pl - pr;
      const usable = Math.max(MIN_STAVE_WIDTH, Math.floor(inner));
      if (usable > 0) setContainerWidth(usable);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    host.innerHTML = '';

    const staveWidth = Math.max(
      MIN_STAVE_WIDTH,
      Math.min(MAX_STAVE_WIDTH, Math.floor(containerWidth)),
    );

    const [num, den] = timeSig.split('/').map(Number);
    const showTimeSig = mode === 'rhythm' || mode === 'melody';

    // Determinar la fuente de compases según el modo.
    const measures: (RhythmNote[] | MelodyNote[])[] =
      mode === 'rhythm'
        ? rhythmMeasures ?? []
        : mode === 'melody'
          ? melodyMeasures ?? []
          : [[] as RhythmNote[]]; // modo nota: un "compás" con la nota única.
    const measureCount = Math.max(1, measures.length);

    // Calcular cuántos compases caben por fila.
    // La 1ª fila tiene menos espacio útil (clave + signatura); las demás solo clave.
    const usable = staveWidth - 20;
    // Estimamos: la 1ª fila necesita FIRST_ROW_CLEF_EXTRA extras para clave+compás.
    // Compases por fila = floor((usable - clefExtra) / MIN_MEASURE_WIDTH).
    const measuresPerRowFirst = Math.max(
      1,
      Math.floor((usable - FIRST_ROW_CLEF_EXTRA) / MIN_MEASURE_WIDTH) + 1,
    );
    const measuresPerRowOther = Math.max(
      1,
      Math.floor((usable - OTHER_ROW_CLEF_EXTRA) / MIN_MEASURE_WIDTH) + 1,
    );

    // Distribuye compases por filas.
    const rows: number[][] = [];
    let idx = 0;
    while (idx < measureCount) {
      const rowIsFirst = rows.length === 0;
      const cap = rowIsFirst ? measuresPerRowFirst : measuresPerRowOther;
      const chunk: number[] = [];
      for (let k = 0; k < cap && idx < measureCount; k++) chunk.push(idx++);
      rows.push(chunk);
    }

    const rowStaveHeight = pianoGrand ? STAVE_HEIGHT * 2 : STAVE_HEIGHT;
    const totalHeight = rows.length * rowStaveHeight + (rows.length - 1) * ROW_GAP + 30;

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(staveWidth, totalHeight);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 12);

    const topClef = VEX_CLEF[clef];
    const notePositions: { x: number; y: number }[] = [];
    const rowEndsX: { x: number; y: number }[] = [];
    let contentStartX = 10;
    let currentY = 10;

    for (let r = 0; r < rows.length; r++) {
      const rowMeasures = rows[r];
      const isFirstRow = r === 0;
      const clefExtra = isFirstRow ? FIRST_ROW_CLEF_EXTRA : OTHER_ROW_CLEF_EXTRA;
      const rowStartX = 10;
      const rowUsableForMeasures = usable - clefExtra;
      const measureWidth = rowUsableForMeasures / rowMeasures.length;

      for (let ci = 0; ci < rowMeasures.length; ci++) {
        const mIdx = rowMeasures[ci];
        const isFirstInRow = ci === 0;
        const isLastMeasureOverall = mIdx === measureCount - 1;
        // Sólo el primer compás de la fila lleva el "clef extra".
        const x =
          isFirstInRow
            ? rowStartX
            : rowStartX + clefExtra + ci * measureWidth;
        const width = isFirstInRow ? clefExtra + measureWidth : measureWidth;
        const y = currentY;

        // Pentagrama superior.
        const topStave = new Stave(x, y, width);
        if (isFirstInRow) topStave.addClef(topClef);
        if (isFirstRow && isFirstInRow && showTimeSig) topStave.addTimeSignature(timeSig);
        if (isLastMeasureOverall) topStave.setEndBarType(Barline.type.END);
        topStave.setContext(ctx).draw();

        if (isFirstInRow && isFirstRow) {
          contentStartX = topStave.getNoteStartX();
        }

        const topBuilt = buildNotes({
          mode,
          noteKey,
          noteAccidental,
          rhythm: mode === 'rhythm' ? (measures[mIdx] as RhythmNote[]) : undefined,
          rhythmNoteKey: rhythmNoteKey ?? defaultRhythmKey(clef),
          melody: mode === 'melody' ? (measures[mIdx] as MelodyNote[]) : undefined,
          clefForNotes: topClef,
          pianoGrand,
          whichStaff: 'top',
        });
        drawVoiceAndTies(ctx, topStave, topBuilt.notes, topBuilt.ties, num, den, width);

        // Posiciones para el cursor (incluye silencios: el cursor debe pasar por ellos).
        // Sólo consideramos las notas del stave superior para el cursor.
        if (mode === 'rhythm' || mode === 'melody') {
          for (const n of topBuilt.notes) {
            notePositions.push({ x: n.getAbsoluteX(), y });
          }
        }

        // Pentagrama inferior (piano grand).
        if (pianoGrand) {
          const bottomStave = new Stave(x, y + STAVE_HEIGHT, width);
          if (isFirstInRow) bottomStave.addClef('bass');
          if (isFirstRow && isFirstInRow && showTimeSig) bottomStave.addTimeSignature(timeSig);
          if (isLastMeasureOverall) bottomStave.setEndBarType(Barline.type.END);
          bottomStave.setContext(ctx).draw();

          const bottomBuilt = buildNotes({
            mode,
            noteKey,
            noteAccidental,
            rhythm: mode === 'rhythm' ? (measures[mIdx] as RhythmNote[]) : undefined,
            rhythmNoteKey: rhythmNoteKey ?? defaultRhythmKey(clef),
            melody: mode === 'melody' ? (measures[mIdx] as MelodyNote[]) : undefined,
            clefForNotes: 'bass',
            pianoGrand,
            whichStaff: 'bottom',
          });
          drawVoiceAndTies(ctx, bottomStave, bottomBuilt.notes, bottomBuilt.ties, num, den, width);
        }

        // Fin de fila: X extrema derecha del último compás de la fila.
        if (ci === rowMeasures.length - 1) {
          rowEndsX.push({ x: x + width, y });
        }
      }

      currentY += rowStaveHeight + ROW_GAP;
    }

    // Exponer layout.
    if (onLayout) {
      onLayout({
        width: staveWidth,
        height: totalHeight,
        contentStartX,
        notePositions,
        rowEndsX,
        rowHeight: rowStaveHeight,
      });
    }
  }, [
    clef,
    pianoGrand,
    timeSig,
    mode,
    noteKey,
    noteAccidental,
    rhythmMeasures,
    rhythmNoteKey,
    melodyMeasures,
    containerWidth,
    onLayout,
  ]);

  return (
    <div ref={wrapperRef} className="vexflow-host">
      <div ref={svgHostRef} className="vexflow-svg" />
      <div
        ref={playheadRef}
        className="vexflow-playhead"
        aria-hidden="true"
        style={{ opacity: 0, transform: 'translate(0px, 0px)', height: `${STAVE_HEIGHT}px` }}
      />
    </div>
  );
});

function drawVoiceAndTies(
  ctx: any,
  stave: Stave,
  notes: StaveNote[],
  ties: StaveTie[],
  numBeats: number,
  beatValue: number,
  measureWidth: number,
) {
  if (notes.length === 0) return;
  const voice = new Voice({ num_beats: numBeats, beat_value: beatValue });
  voice.setStrict(false);
  voice.addTickables(notes);
  new Formatter().joinVoices([voice]).format([voice], Math.max(80, measureWidth - 40));
  voice.draw(ctx, stave);
  ties.forEach((t) => t.setContext(ctx).draw());
}

interface BuildOpts {
  mode: 'note' | 'rhythm' | 'melody';
  noteKey?: string;
  noteAccidental?: AccidentalSym;
  rhythm?: RhythmNote[];
  rhythmNoteKey: string;
  melody?: MelodyNote[];
  clefForNotes: 'treble' | 'bass' | 'alto';
  pianoGrand: boolean;
  whichStaff: 'top' | 'bottom';
}

interface BuiltStaff {
  notes: StaveNote[];
  ties: StaveTie[];
}

function buildNotes(opts: BuildOpts): BuiltStaff {
  const {
    mode,
    noteKey,
    noteAccidental,
    rhythm,
    rhythmNoteKey,
    melody,
    clefForNotes,
    pianoGrand,
    whichStaff,
  } = opts;

  if (mode === 'melody') {
    if (!melody || melody.length === 0) return { notes: [], ties: [] };
    if (pianoGrand && whichStaff === 'bottom') return { notes: [], ties: [] };

    const restKey = defaultRhythmKey(clefForNotes);
    const notes: StaveNote[] = melody.map((n) => {
      const sn = new StaveNote({
        clef: clefForNotes,
        keys: [n.isRest ? restKey : n.key ?? restKey],
        duration: n.isRest ? `${n.duration}r` : n.duration,
      });
      if (!n.isRest && n.accidental) {
        sn.addModifier(new Accidental(n.accidental), 0);
      }
      if (n.dotted && !n.isRest) {
        Dot.buildAndAttach([sn], { all: true });
      }
      if (n.staccato && !n.isRest) {
        const artic = new Articulation('a.');
        artic.setPosition(Modifier.Position.BELOW);
        sn.addModifier(artic, 0);
      }
      return sn;
    });

    const ties: StaveTie[] = [];
    for (let i = 0; i < melody.length - 1; i++) {
      if (melody[i].tiedToNext && !melody[i].isRest && !melody[i + 1].isRest) {
        ties.push(
          new StaveTie({
            first_note: notes[i],
            last_note: notes[i + 1],
            first_indices: [0],
            last_indices: [0],
          }),
        );
      }
    }
    return { notes, ties };
  }

  if (mode === 'note') {
    if (!noteKey) return { notes: [], ties: [] };
    if (pianoGrand) {
      const octave = parseInt(noteKey.split('/')[1], 10);
      const letter = noteKey.split('/')[0].toLowerCase();
      const goesTop = octave >= 4 && !(octave === 4 && letter === 'c' && false);
      const shouldDraw = whichStaff === 'top' ? goesTop : !goesTop;
      if (!shouldDraw) return { notes: [], ties: [] };
    }
    const sn = new StaveNote({
      clef: clefForNotes,
      keys: [noteKey],
      duration: 'w',
    });
    if (noteAccidental) {
      sn.addModifier(new Accidental(noteAccidental), 0);
    }
    return { notes: [sn], ties: [] };
  }

  // Modo ritmo
  if (!rhythm || rhythm.length === 0) return { notes: [], ties: [] };
  if (pianoGrand && whichStaff === 'bottom') return { notes: [], ties: [] };

  const notes: StaveNote[] = rhythm.map((r) => {
    const sn = new StaveNote({
      clef: clefForNotes,
      keys: [rhythmNoteKey],
      duration: r.isRest ? `${r.duration}r` : r.duration,
    });
    if (r.dotted && !r.isRest) {
      Dot.buildAndAttach([sn], { all: true });
    }
    if (r.staccato && !r.isRest) {
      const artic = new Articulation('a.');
      artic.setPosition(Modifier.Position.BELOW);
      sn.addModifier(artic, 0);
    }
    return sn;
  });

  const ties: StaveTie[] = [];
  for (let i = 0; i < rhythm.length - 1; i++) {
    if (rhythm[i].tiedToNext) {
      ties.push(
        new StaveTie({
          first_note: notes[i],
          last_note: notes[i + 1],
          first_indices: [0],
          last_indices: [0],
        }),
      );
    }
  }

  return { notes, ties };
}

function defaultRhythmKey(clef: ClefId): string {
  switch (clef) {
    case 'treble':
      return 'b/4';
    case 'bass':
      return 'd/3';
    case 'alto':
      return 'c/4';
  }
}
