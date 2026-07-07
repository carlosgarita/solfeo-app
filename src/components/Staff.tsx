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
/** Ancho mínimo del área musical de un compás (sin clave). */
const MIN_MEASURE_WIDTH = 160;
/** Espacio reservado en el primer compás de cada fila para clave + compás. */
const FIRST_MEASURE_CLEF_EXTRA = 72;

/** Cuántos compases caben en una fila respetando MIN_MEASURE_WIDTH. */
function measuresPerRowFor(usableWidth: number, clefExtra: number, remaining: number): number {
  const musicWidth = Math.max(MIN_MEASURE_WIDTH, usableWidth - clefExtra);
  const maxByWidth = Math.max(1, Math.floor(musicWidth / MIN_MEASURE_WIDTH));
  return Math.min(remaining, maxByWidth);
}

/** Reparte índices de compases en filas. */
function buildMeasureRows(measureCount: number, usableWidth: number): number[][] {
  const rows: number[][] = [];
  let idx = 0;
  while (idx < measureCount) {
    const cap = measuresPerRowFor(usableWidth, FIRST_MEASURE_CLEF_EXTRA, measureCount - idx);
    const chunk: number[] = [];
    for (let k = 0; k < cap && idx < measureCount; k++) chunk.push(idx++);
    rows.push(chunk);
  }
  return rows;
}

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

    const measures: (RhythmNote[] | MelodyNote[])[] =
      mode === 'rhythm'
        ? rhythmMeasures ?? []
        : mode === 'melody'
          ? melodyMeasures ?? []
          : [[] as RhythmNote[]];
    if (measures.length === 0) return;
    const measureCount = measures.length;

    const usable = staveWidth - 20;
    const rows = buildMeasureRows(measureCount, usable);

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
      const rowMusicWidth = usable - FIRST_MEASURE_CLEF_EXTRA;
      const measureWidth = rowMusicWidth / rowMeasures.length;
      const rowStartX = 10;

      for (let ci = 0; ci < rowMeasures.length; ci++) {
        const mIdx = rowMeasures[ci];
        const isFirstInRow = ci === 0;
        const isLastMeasureOverall = mIdx === measureCount - 1;

        const x = isFirstInRow
          ? rowStartX
          : rowStartX + FIRST_MEASURE_CLEF_EXTRA + ci * measureWidth;
        const width = isFirstInRow ? FIRST_MEASURE_CLEF_EXTRA + measureWidth : measureWidth;
        const y = currentY;

        const topStave = new Stave(x, y, width);
        if (isFirstInRow) topStave.addClef(topClef);
        if (isFirstRow && isFirstInRow && showTimeSig) topStave.addTimeSignature(timeSig);
        topStave.setEndBarType(
          isLastMeasureOverall ? Barline.type.END : Barline.type.SINGLE,
        );
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
        drawVoiceAndTies(ctx, topStave, topBuilt.notes, topBuilt.ties, num, den);

        if (mode === 'rhythm' || mode === 'melody') {
          for (const n of topBuilt.notes) {
            notePositions.push({ x: n.getAbsoluteX(), y });
          }
        }

        if (pianoGrand) {
          const bottomStave = new Stave(x, y + STAVE_HEIGHT, width);
          if (isFirstInRow) bottomStave.addClef('bass');
          if (isFirstRow && isFirstInRow && showTimeSig) bottomStave.addTimeSignature(timeSig);
          bottomStave.setEndBarType(
            isLastMeasureOverall ? Barline.type.END : Barline.type.SINGLE,
          );
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
          drawVoiceAndTies(ctx, bottomStave, bottomBuilt.notes, bottomBuilt.ties, num, den);
        }

        if (ci === rowMeasures.length - 1) {
          rowEndsX.push({ x: x + width, y });
        }
      }

      currentY += rowStaveHeight + ROW_GAP;
    }

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
  ctx: ReturnType<Renderer['getContext']>,
  stave: Stave,
  notes: StaveNote[],
  ties: StaveTie[],
  numBeats: number,
  beatValue: number,
) {
  if (notes.length === 0) return;
  try {
    const voice = new Voice({ num_beats: numBeats, beat_value: beatValue });
    voice.setStrict(true);
    voice.addTickables(notes);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(ctx, stave);
    ties.forEach((t) => t.setContext(ctx).draw());
  } catch (err) {
    console.warn('[Staff] Error al dibujar compás:', err);
  }
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
