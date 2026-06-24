import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  Articulation,
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
  /** Ancho total del SVG en píxeles. */
  width: number;
  /** Alto total del SVG en píxeles. */
  height: number;
  /** Posición X (en px) donde el cursor entra a la zona musical (después de la clave/compás). */
  contentStartX: number;
  /** Posición X (en px) donde termina la zona musical (final del stave). */
  contentEndX: number;
  /** Posición X (en px) absoluta del ataque de cada nota del ritmo. */
  notePositions: number[];
}

export interface StaffHandle {
  /** Mueve el cursor (playhead) a la posición X dada (en px). Pasa `null` para ocultarlo. */
  setPlayhead: (x: number | null) => void;
}

interface StaffProps {
  clef: ClefId;
  pianoGrand: boolean;
  timeSig: TimeSignature;
  mode: 'note' | 'rhythm' | 'melody';
  /** Modo nota: clave VexFlow ej. "c/4" o "c#/4". */
  noteKey?: string;
  /** Alteración explícita (necesaria para becuadros; redundante para # y b). */
  noteAccidental?: AccidentalSym;
  rhythm?: RhythmNote[];
  rhythmNoteKey?: string;
  melody?: MelodyNote[];
  /** Se llama tras renderizar el SVG con el layout para sincronizar el cursor externo. */
  onLayout?: (layout: StaffLayout) => void;
}

const VEX_CLEF: Record<ClefId, 'treble' | 'bass' | 'alto'> = {
  treble: 'treble',
  bass: 'bass',
  alto: 'alto',
};

const MIN_STAVE_WIDTH = 280;
const MAX_STAVE_WIDTH = 560;
const STAVE_HEIGHT = 120;

export const Staff = forwardRef<StaffHandle, StaffProps>(function Staff(
  {
    clef,
    pianoGrand,
    timeSig,
    mode,
    noteKey,
    noteAccidental,
    rhythm,
    rhythmNoteKey,
    melody,
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
      setPlayhead(x: number | null) {
        const el = playheadRef.current;
        if (!el) return;
        if (x == null) {
          el.style.opacity = '0';
        } else {
          el.style.opacity = '1';
          el.style.transform = `translateX(${x}px)`;
        }
      },
    }),
    [],
  );

  // Observar el ancho disponible para que el pentagrama nunca exceda el contenedor.
  // Medimos el padre (.score-card) porque el wrapper se autoajusta al SVG.
  useEffect(() => {
    const host = wrapperRef.current;
    if (!host) return;
    const parent = host.parentElement ?? host;
    const update = () => {
      const w = parent.clientWidth;
      // Restamos el padding interno del score-card aproximado (22px * 2).
      const usable = Math.max(MIN_STAVE_WIDTH, w - 8);
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
    const totalHeight = pianoGrand ? STAVE_HEIGHT * 2 + 20 : STAVE_HEIGHT + 20;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(staveWidth, totalHeight);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 12);

    const [num, den] = timeSig.split('/').map(Number);
    const showTimeSig = mode === 'rhythm' || mode === 'melody';

    // ---- Pentagrama superior ----
    const topClef = VEX_CLEF[clef];
    const topStave = new Stave(10, 10, staveWidth - 20);
    topStave.addClef(topClef);
    if (showTimeSig) topStave.addTimeSignature(timeSig);
    topStave.setContext(ctx).draw();

    const top = buildNotes({
      mode,
      noteKey,
      noteAccidental,
      rhythm,
      rhythmNoteKey: rhythmNoteKey ?? defaultRhythmKey(clef),
      melody,
      clefForNotes: topClef,
      pianoGrand,
      whichStaff: 'top',
    });
    drawVoiceAndTies(ctx, topStave, top.notes, top.ties, num, den, staveWidth);

    // ---- Pentagrama inferior (modo piano) ----
    if (pianoGrand) {
      const bottomStave = new Stave(10, STAVE_HEIGHT + 10, staveWidth - 20);
      bottomStave.addClef('bass');
      if (showTimeSig) bottomStave.addTimeSignature(timeSig);
      bottomStave.setContext(ctx).draw();

      const bottom = buildNotes({
        mode,
        noteKey,
        noteAccidental,
        rhythm,
        rhythmNoteKey: rhythmNoteKey ?? defaultRhythmKey(clef),
        melody,
        clefForNotes: 'bass',
        pianoGrand,
        whichStaff: 'bottom',
      });
      drawVoiceAndTies(ctx, bottomStave, bottom.notes, bottom.ties, num, den, staveWidth);
    }

    // Exponer el layout (posiciones X de cada nota) para que el padre pueda
    // sincronizar el cursor (playhead) con el audio.
    if (onLayout) {
      const notePositions =
        mode === 'rhythm' || mode === 'melody'
          ? top.notes.map((n) => n.getAbsoluteX())
          : [];
      const contentStartX =
        notePositions.length > 0
          ? notePositions[0]
          : topStave.getNoteStartX();
      const contentEndX = topStave.getNoteEndX();
      onLayout({
        width: staveWidth,
        height: totalHeight,
        contentStartX,
        contentEndX,
        notePositions,
      });
    }
  }, [
    clef,
    pianoGrand,
    timeSig,
    mode,
    noteKey,
    noteAccidental,
    rhythm,
    rhythmNoteKey,
    melody,
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
        style={{ opacity: 0, transform: 'translateX(0px)' }}
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
  staveWidth: number,
) {
  if (notes.length === 0) return;
  const voice = new Voice({ num_beats: numBeats, beat_value: beatValue });
  voice.setStrict(false);
  voice.addTickables(notes);
  new Formatter().joinVoices([voice]).format([voice], Math.max(120, staveWidth - 120));
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
    // En modo melodía dibujamos siempre en el stave superior (con la clave elegida).
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
      // Heurística: C4 (do central) y todo lo de arriba va al pentagrama de Sol.
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
