import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Staff, type StaffHandle, type StaffLayout } from './components/Staff';
import {
  type ClefId,
  type MelodyNote,
  type NoteExercise,
  type RhythmNote,
  type TempoId,
  TEMPOS,
  TEMPO_ORDER,
  type TimeSignature,
  figureNameEs,
  generateMeasureByLevel,
  generateMelodyByLevel,
  generateNoteExercise,
  melodySummaryEs,
  vexKeyToFrequency,
  vexNoteToEnglish,
  vexNoteToSpanish,
} from './lib/music';
import { schedulePlayback, type PlayableNote, type PlaybackHandle } from './lib/audio';

const BPM_OPTIONS = [50, 60, 70, 80, 90, 100, 110, 120, 140, 160] as const;

type Mode = 'note' | 'rhythm' | 'melody';

export default function App() {
  const [mode, setMode] = useState<Mode>('note');
  const [clef, setClef] = useState<ClefId>('treble');
  const [timeSig, setTimeSig] = useState<TimeSignature>('4/4');
  const [pianoGrand, setPianoGrand] = useState(false);
  const [showAnswer, setShowAnswer] = useState(true);
  const [tempo, setTempo] = useState<TempoId>('normal');
  const [autoPlay, setAutoPlay] = useState(false);
  const [noteLevel, setNoteLevel] = useState(1);
  const [rhythmLevel, setRhythmLevel] = useState(1);
  const [melodyLevel, setMelodyLevel] = useState(1);

  // Estado de cada ejercicio
  const [currentNote, setCurrentNote] = useState<NoteExercise>(() =>
    generateNoteExercise('treble', 1),
  );
  const [currentRhythm, setCurrentRhythm] = useState<RhythmNote[]>(() =>
    generateMeasureByLevel('4/4', 1),
  );
  const [currentMelody, setCurrentMelody] = useState<MelodyNote[]>(() =>
    generateMelodyByLevel('4/4', 1, 'treble'),
  );
  const [revealNote, setRevealNote] = useState(true);

  const [progress, setProgress] = useState(0);
  const lastSig = useRef('');

  // ---- Reproducción de ritmo ----
  const [bpm, setBpm] = useState<number>(80);
  const [countInOn, setCountInOn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const staffRef = useRef<StaffHandle>(null);
  const layoutRef = useRef<StaffLayout | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopPlayback = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (playbackRef.current) {
      playbackRef.current.stop();
      playbackRef.current = null;
    }
    staffRef.current?.setPlayhead(null);
    setIsPlaying(false);
  }, []);

  const nextNote = useCallback(() => {
    setCurrentNote((prev) => generateNoteExercise(clef, noteLevel, prev.key));
    setRevealNote(showAnswer);
  }, [clef, noteLevel, showAnswer]);

  const nextRhythm = useCallback(() => {
    stopPlayback();
    setCurrentRhythm(generateMeasureByLevel(timeSig, rhythmLevel));
  }, [timeSig, rhythmLevel, stopPlayback]);

  const nextMelody = useCallback(() => {
    stopPlayback();
    setCurrentMelody(generateMelodyByLevel(timeSig, melodyLevel, clef));
  }, [timeSig, melodyLevel, clef, stopPlayback]);

  // Regenerar el ejercicio cuando cambian parámetros relevantes (clave/nivel/compás)
  useEffect(() => {
    const sig = `note|${clef}|${noteLevel}`;
    if (lastSig.current === sig) return;
    lastSig.current = sig;
    setCurrentNote(generateNoteExercise(clef, noteLevel));
    setRevealNote(showAnswer);
    // No incluimos showAnswer aquí para no regenerar al alternar el toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef, noteLevel]);

  useEffect(() => {
    setCurrentRhythm(generateMeasureByLevel(timeSig, rhythmLevel));
  }, [timeSig, rhythmLevel]);

  useEffect(() => {
    setCurrentMelody(generateMelodyByLevel(timeSig, melodyLevel, clef));
  }, [timeSig, melodyLevel, clef]);

  const advance = useCallback(() => {
    if (mode === 'note') nextNote();
    else if (mode === 'rhythm') nextRhythm();
    else nextMelody();
  }, [mode, nextNote, nextRhythm, nextMelody]);

  // Atajos de teclado: Espacio = siguiente, P = play/pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        advance();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setAutoPlay((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) {
      setProgress(0);
      return;
    }
    const intervalMs = TEMPOS[tempo].intervalMs;
    let raf = 0;
    let startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(elapsed / intervalMs, 1);
      setProgress(ratio);
      if (elapsed >= intervalMs) {
        advance();
        startedAt = performance.now();
        setProgress(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoPlay, tempo, advance]);

  // Sincronizar revelar nota con el switch del sidebar
  useEffect(() => {
    setRevealNote(showAnswer);
  }, [showAnswer]);

  // Detener reproducción si cambian parámetros relevantes o salimos del modo activo.
  useEffect(() => {
    stopPlayback();
  }, [
    mode,
    clef,
    timeSig,
    rhythmLevel,
    melodyLevel,
    pianoGrand,
    currentRhythm,
    currentMelody,
    stopPlayback,
  ]);

  // Limpiar al desmontar.
  useEffect(() => stopPlayback, [stopPlayback]);

  const handleStaffLayout = useCallback((layout: StaffLayout) => {
    layoutRef.current = layout;
  }, []);

  const startPlayback = useCallback(() => {
    if (isPlaying) return;
    if (mode !== 'rhythm' && mode !== 'melody') return;
    const layout = layoutRef.current;
    if (!layout || layout.notePositions.length === 0) return;

    const [num] = timeSig.split('/').map(Number);
    const countIn = countInOn ? num : 0;

    // Construir las notas reproducibles según el modo.
    const playableNotes: PlayableNote[] =
      mode === 'rhythm'
        ? currentRhythm.map((n) => ({
            duration: n.duration,
            isRest: n.isRest,
            dotted: n.dotted,
            tiedToNext: n.tiedToNext,
            staccato: n.staccato,
          }))
        : currentMelody.map((n) => ({
            duration: n.duration,
            isRest: n.isRest,
            dotted: n.dotted,
            tiedToNext: n.tiedToNext,
            staccato: n.staccato,
            freq: n.isRest || !n.key ? undefined : vexKeyToFrequency(n.key),
          }));

    // Misma fuente para la animación del cursor (deben coincidir 1-a-1
    // con las posiciones expuestas por el Staff).
    const sourceNotes: { duration: string; dotted?: boolean }[] =
      mode === 'rhythm' ? currentRhythm : currentMelody;

    const handle = schedulePlayback({
      notes: playableNotes,
      bpm,
      countIn,
      beatsPerMeasure: num,
      onEnd: () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        playbackRef.current = null;
        staffRef.current?.setPlayhead(null);
        setIsPlaying(false);
      },
    });
    playbackRef.current = handle;
    setIsPlaying(true);

    // Mapa beatMusical -> X en píxeles.
    // Las posiciones de las notas en VexFlow no son lineales con el tiempo
    // (cabeza de la nota está desplazada), así que interpolamos entre el
    // arranque de cada figura y el de la siguiente / final del compás.
    const beatsTotal = handle.musicDurationSec / (60 / bpm);
    const noteStartBeats: number[] = [];
    let acc = 0;
    for (const n of sourceNotes) {
      noteStartBeats.push(acc);
      const base = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 }[n.duration] ?? 1;
      acc += n.dotted ? base * 1.5 : base;
    }
    const positions = layout.notePositions;
    const endX = layout.contentEndX;

    const beatToX = (beat: number): number => {
      if (positions.length === 0) return layout.contentStartX;
      if (beat <= noteStartBeats[0]) return positions[0];
      for (let i = 0; i < positions.length; i++) {
        const startB = noteStartBeats[i];
        const nextB = i + 1 < positions.length ? noteStartBeats[i + 1] : beatsTotal;
        if (beat >= startB && beat <= nextB) {
          const startX = positions[i];
          const nextX = i + 1 < positions.length ? positions[i + 1] : endX;
          const t = nextB === startB ? 0 : (beat - startB) / (nextB - startB);
          return startX + (nextX - startX) * t;
        }
      }
      return endX;
    };

    const tick = () => {
      const cur = handle.ctx.currentTime;
      const elapsedFromMusic = cur - handle.musicStartTime;
      if (cur < handle.musicStartTime) {
        // Cuenta atrás: cursor justo antes de la primera nota, parpadeando.
        staffRef.current?.setPlayhead(layout.contentStartX);
      } else if (elapsedFromMusic >= handle.musicDurationSec) {
        staffRef.current?.setPlayhead(endX);
      } else {
        const beat = elapsedFromMusic / (60 / bpm);
        staffRef.current?.setPlayhead(beatToX(beat));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [bpm, countInOn, currentRhythm, currentMelody, isPlaying, mode, timeSig]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  }, [isPlaying, startPlayback, stopPlayback]);

  const rhythmSummary = useMemo(() => {
    return currentRhythm.map((n) => figureNameEs(n)).join(' · ');
  }, [currentRhythm]);

  const melodySummary = useMemo(() => melodySummaryEs(currentMelody), [currentMelody]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">♪</div>
          <div>
            Solfeo
            <div className="brand-sub">Práctica para principiantes</div>
          </div>
        </div>

        <nav className="tabs" role="tablist" aria-label="Modo de práctica">
          <button
            role="tab"
            aria-selected={mode === 'note'}
            className={`tab ${mode === 'note' ? 'active' : ''}`}
            onClick={() => setMode('note')}
          >
            Notas
          </button>
          <button
            role="tab"
            aria-selected={mode === 'rhythm'}
            className={`tab ${mode === 'rhythm' ? 'active' : ''}`}
            onClick={() => setMode('rhythm')}
          >
            Tiempos
          </button>
          <button
            role="tab"
            aria-selected={mode === 'melody'}
            className={`tab ${mode === 'melody' ? 'active' : ''}`}
            onClick={() => setMode('melody')}
          >
            Melodía
          </button>
        </nav>
      </header>

      <main className="content">
        <Sidebar
          mode={mode}
          clef={clef}
          timeSig={timeSig}
          pianoGrand={pianoGrand}
          showAnswer={showAnswer}
          noteLevel={noteLevel}
          rhythmLevel={rhythmLevel}
          melodyLevel={melodyLevel}
          countInOn={countInOn}
          onClefChange={setClef}
          onTimeSigChange={setTimeSig}
          onPianoGrandChange={setPianoGrand}
          onShowAnswerChange={setShowAnswer}
          onNoteLevelChange={setNoteLevel}
          onRhythmLevelChange={setRhythmLevel}
          onMelodyLevelChange={setMelodyLevel}
          onCountInChange={setCountInOn}
        />

        <section className="stage" aria-label="Pentagrama">
          <div className="stage-header">
            <div>
              <h1 className="stage-title">
                {mode === 'note'
                  ? 'Práctica de notas'
                  : mode === 'rhythm'
                    ? 'Práctica de tiempos'
                    : 'Práctica de melodía'}
              </h1>
              <p className="stage-sub">
                {mode === 'note'
                  ? 'Identifica la nota en el pentagrama y tócala en tu instrumento.'
                  : mode === 'rhythm'
                    ? 'Lee el compás y toca el ritmo en una sola nota cómoda.'
                    : 'Lee la partitura: combina notas y ritmo como una pieza real.'}
              </p>
            </div>
            <div className="stage-actions">
              {mode === 'note' && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setRevealNote((v) => !v)}
                  aria-pressed={revealNote}
                >
                  {revealNote ? 'Ocultar nombre' : 'Revelar nombre'}
                </button>
              )}
              {(mode === 'rhythm' || mode === 'melody') && (
                <div className="tempo-group" role="group" aria-label="Reproducir compás">
                  <button
                    className={`btn ${isPlaying ? 'btn-danger' : 'btn-success'} tempo-play`}
                    onClick={togglePlayback}
                    aria-pressed={isPlaying}
                    title="Reproducir el compás con el cursor"
                  >
                    {isPlaying ? '⏹ Detener' : '▶ Reproducir'}
                  </button>
                  <select
                    className="select tempo-select"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    aria-label="BPM"
                    title="Pulsos por minuto (referido a la negra)"
                    disabled={isPlaying}
                  >
                    {BPM_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b} BPM
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="tempo-group" role="group" aria-label="Modo automático">
                <button
                  className={`btn ${autoPlay ? 'btn-danger' : 'btn-success'} tempo-play`}
                  onClick={() => setAutoPlay((v) => !v)}
                  aria-pressed={autoPlay}
                  title="Atajo: P"
                >
                  {autoPlay ? '⏸ Pausar' : '▶ Auto'}
                </button>
                <select
                  className="select tempo-select"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value as TempoId)}
                  aria-label="Velocidad"
                  title="Velocidad del modo automático"
                >
                  {TEMPO_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {TEMPOS[id].label} · {(TEMPOS[id].intervalMs / 1000).toFixed(1)}s
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={advance}>
                {mode === 'note' ? 'Siguiente nota' : 'Siguiente compás'}
              </button>
              {/* (Mismo texto para tiempos y melodía: ambos generan un compás nuevo.) */}
            </div>
          </div>

          <div className="progress-bar" aria-hidden="true">
            <div
              className={`progress-fill ${autoPlay ? 'is-playing' : ''}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="score-card">
            <Staff
              ref={staffRef}
              clef={clef}
              pianoGrand={pianoGrand}
              timeSig={timeSig}
              mode={mode}
              noteKey={mode === 'note' ? currentNote.key : undefined}
              noteAccidental={mode === 'note' ? currentNote.accidental : undefined}
              rhythm={mode === 'rhythm' ? currentRhythm : undefined}
              melody={mode === 'melody' ? currentMelody : undefined}
              onLayout={handleStaffLayout}
            />
          </div>

          <div className="answer-card">
            {mode === 'note' ? (
              <div className={`answer-pill ${revealNote ? '' : 'hidden'}`}>
                <span className="label">Nota:</span>
                <span className="value">
                  {vexNoteToSpanish(currentNote.key, currentNote.accidental)} ·{' '}
                  {vexNoteToEnglish(currentNote.key, currentNote.accidental)}
                </span>
              </div>
            ) : mode === 'rhythm' ? (
              <div className="answer-pill">
                <span className="label">Figuras:</span>
                <span className="value" style={{ fontSize: '0.9rem', letterSpacing: 0 }}>
                  {rhythmSummary}
                </span>
              </div>
            ) : (
              <div className="answer-pill">
                <span className="label">Melodía:</span>
                <span className="value" style={{ fontSize: '0.85rem', letterSpacing: 0 }}>
                  {melodySummary}
                </span>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        Fase 1 · Hecho con VexFlow. Próximamente: diagramas de bajo, guitarra y piano.
      </footer>
    </div>
  );
}
