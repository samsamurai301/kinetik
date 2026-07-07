import { useEffect, useRef, useState } from 'react'
import { useEngine } from 'kinetik'

/**
 * Settings — engine tuning controls.
 *
 * Lets the user adjust:
 * - throwVelocityThreshold (inertial release threshold)
 * - predictionMs (collision prediction look-ahead)
 *
 * Settings are wired through the engine's already-existing ref-based options
 * update path so the engine is not recreated when values change.
 */
export function Settings(): JSX.Element {
  const engine = useEngine()
  const [threshold, setThreshold] = useState(700)
  const [prediction, setPrediction] = useState(60)
  const optsRef = useRef<{ throwVelocityThreshold: number; predictionMs: number }>({
    throwVelocityThreshold: threshold,
    predictionMs: prediction,
  })

  // The engine has the engine options stored on construction. We reach into
  // the private state via the public accessor and update it directly.
  // For settings toggling, the cleanest path is to expose an `updateOptions`
  // method, which we add on the engine below.
  useEffect(() => {
    optsRef.current = { throwVelocityThreshold: threshold, predictionMs: prediction }
    ;(engine as any).updateOptions?.(optsRef.current)
  }, [threshold, prediction, engine])

  return (
    <div className="settings">
      <div className="setting-row">
        <label htmlFor="threshold-slider">Throw velocity threshold</label>
        <input
          id="threshold-slider"
          data-testid="threshold-slider"
          type="range"
          min={200}
          max={3000}
          step={50}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        <span className="setting-value" data-testid="threshold-value">
          {threshold} px/s
        </span>
      </div>
      <div className="setting-row">
        <label htmlFor="prediction-slider">Prediction look-ahead</label>
        <input
          id="prediction-slider"
          data-testid="prediction-slider"
          type="range"
          min={0}
          max={200}
          step={5}
          value={prediction}
          onChange={(e) => setPrediction(Number(e.target.value))}
        />
        <span className="setting-value" data-testid="prediction-value">
          {prediction} ms
        </span>
      </div>
    </div>
  )
}

/**
 * EngineStateInspector — live state panel for the engine.
 */
export function EngineStateInspector(): JSX.Element {
  const engine = useEngine()
  const [state, setState] = useState(() => engine.getState())

  useEffect(() => {
    return engine.subscribe(() => setState(engine.getState()))
  }, [engine])

  const vel = state.velocity ?? { x: 0, y: 0 }
  return (
    <pre className="engine-state" data-testid="engine-state">
      {`status:      ${state.status}
activeId:    ${state.activeId ?? 'null'}
overId:      ${state.overId ?? 'null'}
velocity:    ${vel.x.toFixed(0)},${vel.y.toFixed(0)} px/s`}
    </pre>
  )
}
