import { useState, useMemo } from 'react'
import {
  FileUp,
  Plus,
  Edit2,
  FileText,
  Trash2,
  Clock,
  Calendar
} from 'lucide-react'
import { ClassItem, CandidateClass, WEEKDAYS, SHORT_DAYS, ImportResult } from '../types'
import { ImportReviewModal } from './ImportReviewModal'
import { SubjectModal } from './SubjectModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { UndoToast } from './UndoToast'

interface TimetableManagerProps {
  classes: ClassItem[]
  onRefreshClasses: () => Promise<void>
  onShowMessage: (msg: string) => void
}

const DOT_COLORS = [
  'var(--dot-blue)',
  'var(--dot-purple)',
  'var(--dot-orange)',
  'var(--dot-green)',
  'var(--dot-cyan)',
  'var(--dot-pink)'
]

interface DeletedClassUndoRecord {
  classItem: ClassItem
  dayName: string
}

export function TimetableManager({ classes, onRefreshClasses, onShowMessage }: TimetableManagerProps) {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 1)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null)
  const [undoRecord, setUndoRecord] = useState<DeletedClassUndoRecord | null>(null)
  const [lastImportInfo, setLastImportInfo] = useState<string>('Ready • Review and customize your weekly schedule')

  // Classes for selected day sorted by start_time
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

  async function handleSaveSubject(data: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
  }) {
    if (editingClass) {
      await window.hello11824.updateClass(editingClass.id, data)
      onShowMessage(`Updated "${data.title}"`)
    } else {
      await window.hello11824.addClass(data)
      onShowMessage(`Added "${data.title}"`)
    }
    await onRefreshClasses()
  }

  function requestDelete(c: ClassItem) {
    setDeletingClass(c)
  }

  async function confirmDelete() {
    if (!deletingClass) return
    const target = deletingClass
    setDeletingClass(null)

    await window.hello11824.deleteClass(target.id)
    await onRefreshClasses()

    setUndoRecord({
      classItem: target,
      dayName: WEEKDAYS[target.weekday]
    })
    onShowMessage(`Deleted "${target.title}"`)
  }

  async function handleUndoDelete() {
    if (!undoRecord) return
    const { classItem } = undoRecord

    await window.hello11824.addClass({
      title: classItem.title,
      weekday: classItem.weekday,
      startTime: classItem.start_time,
      endTime: classItem.end_time || undefined,
      room: classItem.room || undefined,
      notes: classItem.notes || undefined,
      color: classItem.color || undefined
    })

    setUndoRecord(null)
    await onRefreshClasses()
    onShowMessage(`Restored "${classItem.title}"`)
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
            style={{ width: 34, height: 32, padding: 0, justifyContent: 'center' }}
            onClick={() => {
              setEditingClass(null)
              setShowSubjectModal(true)
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
          const count = classes.filter(c => c.weekday === dayIdx).length
          return (
            <button
              key={dayIdx}
              className={`day-pill-btn ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedDay(dayIdx)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>{SHORT_DAYS[dayIdx]}</span>
              {count > 0 && (
                <span
                  style={{
                    background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'var(--border-subtle)',
                    color: isSelected ? 'var(--accent-purple)' : 'var(--text-secondary)',
                    borderRadius: 999,
                    padding: '0 6px',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timetable Table */}
      <div className="data-table-container">
        {/* Table Header */}
        <div
          className="table-row table-header"
          style={{ gridTemplateColumns: '1.2fr 1.8fr 1.2fr 60px' }}
        >
          <span>Time</span>
          <span>Subject</span>
          <span>Room</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {/* Rows */}
        {dayClasses.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
            No subjects scheduled for {WEEKDAYS[selectedDay]}. Click <strong>+</strong> to add one!
          </div>
        ) : (
          dayClasses.map((c, i) => (
            <div
              key={c.id || i}
              className="table-row"
              style={{ gridTemplateColumns: '1.2fr 1.8fr 1.2fr 60px', alignItems: 'center' }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>
                {c.start_time} {c.end_time ? `– ${c.end_time}` : ''}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="class-dot"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.title}</span>
              </div>

              <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                {c.room || '—'}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button
                  className="win-btn"
                  style={{ width: 24, height: 24 }}
                  title="Edit subject"
                  onClick={() => {
                    setEditingClass(c)
                    setShowSubjectModal(true)
                  }}
                >
                  <Edit2 size={12} color="var(--text-muted)" />
                </button>
                <button
                  className="win-btn"
                  style={{ width: 24, height: 24 }}
                  title="Delete subject"
                  onClick={() => requestDelete(c)}
                >
                  <Trash2 size={12} color="var(--priority-high-text)" />
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
          background: 'var(--bg-card-inner)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2
        }}
      >
        <FileText size={13} color="var(--accent-purple)" />
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
      <SubjectModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjectItem={editingClass}
        defaultWeekday={selectedDay}
        onSave={handleSaveSubject}
      />

      {/* Safe Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingClass)}
        title="Delete Subject"
        subjectTitle={deletingClass?.title || ''}
        timeRange={deletingClass ? `${deletingClass.start_time}${deletingClass.end_time ? ` – ${deletingClass.end_time}` : ''}` : undefined}
        dayName={deletingClass ? WEEKDAYS[deletingClass.weekday] : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingClass(null)}
      />

      {/* Undo Notification Toast (60 seconds) */}
      {undoRecord && (
        <UndoToast
          message={`Subject deleted: "${undoRecord.classItem.title}"`}
          details={`(${undoRecord.classItem.start_time}${undoRecord.classItem.end_time ? ` – ${undoRecord.classItem.end_time}` : ''}) from ${undoRecord.dayName}`}
          onUndo={handleUndoDelete}
          onDismiss={() => setUndoRecord(null)}
          durationMs={60_000}
        />
      )}
    </div>
  )
}
