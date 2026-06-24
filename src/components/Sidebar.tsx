import type { ClefId, TimeSignature } from '../lib/music';
import { CLEFS, NOTE_LEVELS, RHYTHM_LEVELS, TIME_SIGNATURES } from '../lib/music';

interface SidebarProps {
  mode: 'note' | 'rhythm';
  clef: ClefId;
  timeSig: TimeSignature;
  pianoGrand: boolean;
  showAnswer: boolean;
  noteLevel: number;
  rhythmLevel: number;
  countInOn: boolean;
  onClefChange: (c: ClefId) => void;
  onTimeSigChange: (t: TimeSignature) => void;
  onPianoGrandChange: (v: boolean) => void;
  onShowAnswerChange: (v: boolean) => void;
  onNoteLevelChange: (v: number) => void;
  onRhythmLevelChange: (v: number) => void;
  onCountInChange: (v: boolean) => void;
}

export function Sidebar(props: SidebarProps) {
  const {
    mode,
    clef,
    timeSig,
    pianoGrand,
    showAnswer,
    noteLevel,
    rhythmLevel,
    countInOn,
    onClefChange,
    onTimeSigChange,
    onPianoGrandChange,
    onShowAnswerChange,
    onNoteLevelChange,
    onRhythmLevelChange,
    onCountInChange,
  } = props;

  const levels = mode === 'note' ? NOTE_LEVELS : RHYTHM_LEVELS;
  const currentLevel = mode === 'note' ? noteLevel : rhythmLevel;
  const onLevelChange = mode === 'note' ? onNoteLevelChange : onRhythmLevelChange;
  const currentInfo = levels.find((l) => l.id === currentLevel);

  return (
    <aside className="panel" aria-label="Configuración">
      <h2>Configuración</h2>

      <div className="field">
        <label htmlFor="level">Nivel ({mode === 'note' ? 'notas' : 'tiempos'})</label>
        <select
          id="level"
          className="select"
          value={currentLevel}
          onChange={(e) => onLevelChange(Number(e.target.value))}
        >
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        {currentInfo && <p className="hint">{currentInfo.description}</p>}
      </div>

      <div className="field">
        <label htmlFor="clef">Clave</label>
        <select
          id="clef"
          className="select"
          value={clef}
          onChange={(e) => onClefChange(e.target.value as ClefId)}
        >
          {Object.values(CLEFS).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEs}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="time">Compás</label>
        <select
          id="time"
          className="select"
          value={timeSig}
          onChange={(e) => onTimeSigChange(e.target.value as TimeSignature)}
          disabled={mode === 'note'}
        >
          {TIME_SIGNATURES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {mode === 'note' && (
          <p className="hint">El compás solo se usa en la práctica de tiempos.</p>
        )}
      </div>

      <div className="field">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={pianoGrand}
            onChange={(e) => onPianoGrandChange(e.target.checked)}
          />
          Mostrar dos pentagramas (piano)
        </label>
        <p className="hint">Activa el gran pentagrama: Sol arriba, Fa abajo.</p>
      </div>

      {mode === 'note' && (
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showAnswer}
              onChange={(e) => onShowAnswerChange(e.target.checked)}
            />
            Mostrar nombre de la nota
          </label>
          <p className="hint">Útil al principio; quítalo cuando quieras retarte.</p>
        </div>
      )}

      {mode === 'rhythm' && (
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={countInOn}
              onChange={(e) => onCountInChange(e.target.checked)}
            />
            Cuenta atrás antes de reproducir
          </label>
          <p className="hint">
            Marca un compás completo (con acento en el primer pulso) antes del ejercicio.
          </p>
        </div>
      )}

      <div className="field" style={{ marginTop: 22, marginBottom: 0 }}>
        <p className="hint">
          Atajos: <kbd>Espacio</kbd> = siguiente · <kbd>P</kbd> = play/pausa.
        </p>
      </div>
    </aside>
  );
}
