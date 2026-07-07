import { useState } from 'react'
import { useFileDrop } from 'kinetik'

export function FileDropzone(): JSX.Element {
  const [files, setFiles] = useState<File[]>([])
  const { setNodeRef, isOver } = useFileDrop({
    accept: ['image/*', '.pdf', 'text/*'],
    onFiles: (incoming) => {
      setFiles((prev) => [...prev, ...incoming])
    },
    onReject: (reason) => {
      alert(reason)
    },
  })

  return (
    <div>
      <div
        ref={setNodeRef as any}
        className={`dropzone ${isOver ? 'is-over' : ''}`}
        data-over={isOver ? 'true' : 'false'}
        role="region"
        tabIndex={0}
        aria-label="Dropzone for image, PDF, and text uploads"
      >
        {isOver
          ? 'Release to drop the file(s).'
          : 'Drag files here — images, PDFs, text — and drop.'}
      </div>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i} className="file-row">
              <span className="file-name">{f.name}</span>
              <span className="file-meta">
                {f.type || 'unknown'} · {Math.round(f.size / 1024)} KB
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
