import { DndContext } from 'kinetik'
import { SortableList } from './SortableList'
import { Kanban } from './Kanban'
import { PerfMonitor } from './PerfMonitor'
import { FileDropzone } from './FileDropzone'
import { MultiSelectList } from './MultiSelectList'
import { Settings, EngineStateInspector } from './Settings'
import { Calendar } from './Calendar'
import { Dashboard } from './Dashboard'
import { ImageGrid } from './ImageGrid'
import { InfiniteList } from './InfiniteList'

const initialTasks = [
  'Refactor the auth middleware',
  'Write tests for the new billing flow',
  'Investigate the slow query on /dashboard',
  'Migrate the icons to the new SVG system',
  'Add error boundaries around the editor',
  'Polish the onboarding animation',
  'Ship the v2 export endpoint',
  'Review the analytics dashboard PR',
  'Triage the bug queue from yesterday',
  'Document the new plugin API',
]

/**
 * App — the demo. Wraps the app in one outer DndContext so the
 * DragOverlay and PerfMonitor can both subscribe to drag state.
 * The Settings and EngineStateInspector read engine state via useEngine.
 */
export function App(): JSX.Element {
  return (
    <DndContext>
      <div className="app">
        <header className="hero">
          <h1>kinetik</h1>
          <p className="subtitle">
            Drag-and-drop that feels native. Built on correct DOM primitives, not hardware tricks —
            <code> touch-action</code>, <code>setPointerCapture</code>, rAF coalescing,
            transform-only animation, spring physics, FLIP reorder, <strong>velocity prediction</strong>,
            <strong>View Transitions API</strong>.
          </p>
        </header>

        <Settings />

        <div className="section">
          <h2>Sortable list <span className="hint">— restrictToVerticalAxis + View Transitions API</span></h2>
          <SortableList items={initialTasks} />
        </div>

        <div className="section">
          <h2>Multi-select <span className="hint">— Shift-click to select, then drag as a group</span></h2>
          <MultiSelectList />
        </div>

        <div className="section">
          <h2>File drop <span className="hint">— native HTML5 drop, accepts images &amp; PDFs</span></h2>
          <FileDropzone />
        </div>

        <div className="section">
          <h2>Kanban board <span className="hint">— cross-container, closestCenterStrategy</span></h2>
          <Kanban />
        </div>

        <div className="section">
          <h2>Calendar <span className="hint">— move events between days</span></h2>
          <Calendar />
        </div>

        <div className="section">
          <h2>Dashboard <span className="hint">— explicit-position widgets</span></h2>
          <Dashboard />
        </div>

        <div className="section">
          <h2>Image grid <span className="hint">— free-form drag, drop on trash to delete</span></h2>
          <ImageGrid />
        </div>

        <div className="section">
          <h2>Infinite list <span className="hint">— drag toward the end to load more</span></h2>
          <InfiniteList />
        </div>

        <div className="inspector">
          <h3>Engine internal state</h3>
          <EngineStateInspector />
        </div>

        <PerfMonitor />
      </div>
    </DndContext>
  )
}
