import { useEffect, useRef, useState } from 'react';
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
import type { Accidental as AccidentalSym, ClefId, RhythmNote, TimeSignature } from '../lib/music';

interface StaffProps {
  clef: ClefId;
  pianoGrand: boolean;
  timeSig: TimeSignature;
  mode: 'note' | 'rhythm';
  /** Modo nota: clave VexFlow ej. "c/4" o "c#/4". */
  noteKey?: string;
  /** Alteración explícita (necesaria para becuadros; redundante para # y b). */
  noteAccidental?: AccidentalSym;
  rhythm?: RhythmNote[];
  rhythmNoteKey?: string;
}

const VEX_CLEF: Record<ClefId, 'treble' | 'bass' | 'alto'> = {
  treble: 'treble',
  bass: 'bass',
  alto: 'alto',
};

const MIN_STAVE_WIDTH = 280;
const MAX_STAVE_WIDTH = 560;
const STAVE_HEIGHT = 120;

export function Staff({
  clef,
  pianoGrand,
  timeSig,
  mode,
  noteKey,
  noteAccidental,
  rhythm,
  rhythmNoteKey,
}: StaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(MAX_STAVE_WIDTH);

  // Observar el ancho disponible para que el pentagrama nunca exceda el contenedor.
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const update = () => {
      const w = host.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = containerRef.current;
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
    const showTimeSig = mode === 'rhythm';

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
        clefForNotes: 'bass',
        pianoGrand,
        whichStaff: 'bottom',
      });
      drawVoiceAndTies(ctx, bottomStave, bottom.notes, bottom.ties, num, den, staveWidth);
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
    containerWidth,
  ]);

  return <div ref={containerRef} className="vexflow-host" />;
}

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
  mode: 'note' | 'rhythm';
  noteKey?: string;
  noteAccidental?: AccidentalSym;
  rhythm?: RhythmNote[];
  rhythmNoteKey: string;
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
    clefForNotes,
    pianoGrand,
    whichStaff,
  } = opts;

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
