import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Staff } from './components/Staff';
import {
  type ClefId,
  type NoteExercise,
  type RhythmNote,
  type TempoId,
  TEMPOS,
  TEMPO_ORDER,
  type TimeSignature,
  figureNameEs,
  generateMeasureByLevel,
  generateNoteExercise,
  vexNoteToEnglish,
  vexNoteToSpanish,
} from './lib/music';

type Mode = 'note' | 'rhythm';

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

  // Estado de cada ejercicio
  const [currentNote, setCurrentNote] = useState<NoteExercise>(() =>
    generateNoteExercise('treble', 1),
  );
  const [currentRhythm, setCurrentRhythm] = useState<RhythmNote[]>(() =>
    generateMeasureByLevel('4/4', 1),
  );
  const [revealNote, setRevealNote] = useState(true);

  const [progress, setProgress] = useState(0);
  const lastSig = useRef('');

  const nextNote = useCallback(() => {
    setCurrentNote((prev) => generateNoteExercise(clef, noteLevel, prev.key));
    setRevealNote(showAnswer);
  }, [clef, noteLevel, showAnswer]);

  const nextRhythm = useCallback(() => {
    setCurrentRhythm(generateMeasureByLevel(timeSig, rhythmLevel));
  }, [timeSig, rhythmLevel]);

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

  const advance = useCallback(() => {
    if (mode === 'note') nextNote();
    else nextRhythm();
  }, [mode, nextNote, nextRhythm]);

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

  const rhythmSummary = useMemo(() => {
    return currentRhythm.map((n) => figureNameEs(n)).join(' · ');
  }, [currentRhythm]);

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
          onClefChange={setClef}
          onTimeSigChange={setTimeSig}
          onPianoGrandChange={setPianoGrand}
          onShowAnswerChange={setShowAnswer}
          onNoteLevelChange={setNoteLevel}
          onRhythmLevelChange={setRhythmLevel}
        />

        <section className="stage" aria-label="Pentagrama">
          <div className="stage-header">
            <div>
              <h1 className="stage-title">
                {mode === 'note' ? 'Práctica de notas' : 'Práctica de tiempos'}
              </h1>
              <p className="stage-sub">
                {mode === 'note'
                  ? 'Identifica la nota en el pentagrama y tócala en tu instrumento.'
                  : 'Lee el compás y toca el ritmo en una sola nota cómoda.'}
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
              clef={clef}
              pianoGrand={pianoGrand}
              timeSig={timeSig}
              mode={mode}
              noteKey={mode === 'note' ? currentNote.key : undefined}
              noteAccidental={mode === 'note' ? currentNote.accidental : undefined}
              rhythm={mode === 'rhythm' ? currentRhythm : undefined}
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
            ) : (
              <div className="answer-pill">
                <span className="label">Figuras:</span>
                <span className="value" style={{ fontSize: '0.9rem', letterSpacing: 0 }}>
                  {rhythmSummary}
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
