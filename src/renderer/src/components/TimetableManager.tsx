import { useState, useMemo } from 'react'
import {
  FileUp,
  Plus,
  Edit2,
  FileText,
  Trash2
} from 'lucide-react'
import { ClassItem, CandidateClass, WEEKDAYS, SHORT_DAYS, ImportResult } from '../types'
import { ImportReviewModal } from './ImportReviewModal'
import { ClassModal } from './ClassModal'

interface TimetableManagerProps {
  classes: ClassItem[]
  onRefreshClasses: () => Promise<void>
  onShowMessage: (msg: string) => void
}

const DOT_COLORS = [
  'var(--dot-cyan)',
  'var(--dot-pink)',
  'var(--dot-blue)',
  'var(--dot-orange)',
  'var(--dot-purple)',
  'var(--dot-green)'
]

export function TimetableManager({ classes, onRefreshClasses, onShowMessage }: TimetableManagerProps) {
  // Default to Tuesday as in screenshot, or today's weekday
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 2)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [lastImportInfo, setLastImportInfo] = useState<string>('Imported from timetable.pdf • Apr 25, 2025')

  // Classes for selected day
  const dayClasses = useMemo(() => {
    return classes
      .filter(c => c.weekday === selectedDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [classes, selectedDay])

  async function handlePickFile() {
    try {
      const result = await window.hello11824.pickAndExtract()
      if (!result) return
      setImportResult(result)
      setShowImportModal(true)
    } catch (err) {
      onShowMessage(`Error opening file: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleConfirmImport(newClasses: CandidateClass[], mode: 'replace' | 'append') {
    const payload = newClasses.map(c => ({
      title: c.title,
      weekday: c.weekday,
      startTime: c.startTime,
      endTime: c.endTime || undefined,
      room: c.room || undefined,
      notes: c.notes || undefined
    }))

    if (mode === 'replace') {
      await window.hello11824.replaceClasses(payload, importResult?.fileName)
      onShowMessage(`Replaced timetable with ${newClasses.length} subjects.`)
    } else {
      await window.hello11824.appendClasses(payload, importResult?.fileName)
      onShowMessage(`Added ${newClasses.length} subjects to timetable.`)
    }

    if (importResult?.fileName) {
      const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      setLastImportInfo(`Imported from ${importResult.fileName} • ${todayFormatted}`)
    }

    await onRefreshClasses()
  }

  async function handleSaveClass(data: any) {
    if (editingClass) {
      await window.hello11824.updateClass(editingClass.id, data)
      onShowMessage(`Updated "${data.title}"`)
    } else {
      await window.hello11824.addClass(data)
      onShowMessage(`Added "${data.title}"`)
    }
    await onRefreshClasses()
  }

  async function handleDeleteClass(id: number) {
    if (!confirm('Remove this subject?')) return
    await window.hello11824.deleteClass(id)
    await onRefreshClasses()
    onShowMessage('Subject removed.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title">Timetable</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary-pill" onClick={handlePickFile}>
            <FileUp size={13} /> Import Timetable
          </button>
          <button
            className="btn-secondary-pill"
            style={{ width: 32, padding: 0, justifyContent: 'center' }}
            onClick={() => {
              setEditingClass(null)
              setShowClassModal(true)
            }}
            title="Add subject manually"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Day Pills Selector (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
      <div className="day-pills-row">
        {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
          const isSelected = selectedDay === dayIdx
          return (
            <button
              key={dayIdx}
              className={`day-pill-btn ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedDay(dayIdx)}
            >
              {SHORT_DAYS[dayIdx]}
            </button>
          )
        })}
      </div>

      {/* Timetable Table */}
      <div className="data-table-container">
        {/* Table Header */}
        <div
          className="table-row table-header"
          style={{ gridTemplateColumns: '1.2fr 1.8fr 1.2fr 40px' }}
        >
          <span>Time</span>
          <span>Subject</span>
          <span>Room</span>
          <span style={{ textAlign: 'right' }}></span>
        </div>

        {/* Rows */}
        {dayClasses.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No subjects scheduled for {WEEKDAYS[selectedDay]}. Click "+" to add one!
          </div>
        ) : (
          dayClasses.map((c, i) => (
            <div
              key={c.id || i}
              className="table-row"
              style={{ gridTemplateColumns: '1.2fr 1.8fr 1.2fr 40px' }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {c.start_time} {c.end_time ? `– ${c.end_time}` : ''}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="class-dot"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
                <span style={{ color: '#fff', fontWeight: 500 }}>{c.title}</span>
              </div>

              <span style={{ color: 'var(--text-secondary)' }}>
                {c.room || '—'}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button
                  className="win-btn"
                  style={{ width: 22, height: 22 }}
                  title="Edit subject"
                  onClick={() => {
                    setEditingClass(c)
                    setShowClassModal(true)
                  }}
                >
                  <Edit2 size={12} color="var(--text-muted)" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Note Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(12, 18, 34, 0.65)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2
        }}
      >
        <FileText size={13} color="var(--accent-cyan)" />
        <span>{lastImportInfo}</span>
      </div>

      {/* Import Modal */}
      <ImportReviewModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importResult={importResult}
        onConfirm={handleConfirmImport}
      />

      {/* Subject Form Modal */}
      <ClassModal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        classItem={editingClass}
        defaultWeekday={selectedDay}
        onSave={handleSaveClass}
      />
    </div>
  )
}
