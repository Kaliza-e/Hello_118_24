import { useState, useEffect, useMemo } from 'react'
import {
  X,
  Plus,
  Trash2,
  Edit2,
  FileUp,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Clock,
  Sparkles
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { CandidateClass, WEEKDAYS, SHORT_DAYS, ImportResult } from '../types'
import { SubjectModal } from './SubjectModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { UndoToast } from './UndoToast'

interface ImportReviewModalProps {
  isOpen: boolean
  onClose: () => void
  importResult: ImportResult | null
  onConfirm: (classes: CandidateClass[], mode: 'replace' | 'append') => Promise<void>
}

interface DeletedItemUndoRecord {
  item: CandidateClass
  index: number
  dayName: string
}

export function ImportReviewModal({ isOpen, onClose, importResult, onConfirm }: ImportReviewModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [candidates, setCandidates] = useState<CandidateClass[]>([])
  const [rawText, setRawText] = useState('')
  const [saveMode, setSaveMode] = useState<'replace' | 'append'>('append')
  const [isSaving, setIsSaving] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrStatus, setOcrStatus] = useState('')

  // Day-by-day active tab
  const [activeDay, setActiveDay] = useState<number>(1) // Monday by default

  // Subject Modal for Add/Edit
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Safe Deletion Confirmation
  const [deletingCandidate, setDeletingCandidate] = useState<{ item: CandidateClass; index: number } | null>(null)

  // Undo Toast state
  const [undoRecord, setUndoRecord] = useState<DeletedItemUndoRecord | null>(null)

  useEffect(() => {
    if (!importResult) {
      setCurrentStep(1)
      setCandidates([])
      setRawText('')
      return
    }

    setRawText(importResult.text || '')
    const initialCandidates = importResult.candidates || []
    setCandidates(initialCandidates)

    // Advance to Step 2 if candidates or OCR needed
    if (initialCandidates.length > 0 || importResult.needsOcr) {
      setCurrentStep(2)
      // Pick first day with classes as active day
      if (initialCandidates.length > 0) {
        setActiveDay(initialCandidates[0].weekday)
      }
    }

    if (importResult.needsOcr && importResult.imageData) {
      runOcr(importResult.imageData)
    }
  }, [importResult, isOpen])

  async function runOcr(imageData: string) {
    setOcrRunning(true)
    setOcrStatus('Scanning timetable document with OCR…')
    try {
      const worker = await createWorker('eng')
      const ret = await worker.recognize(imageData)
      const text = ret.data.text
      setRawText(text)

      const parsed = await window.hello11824.parseText(text)
      setCandidates(parsed)
      if (parsed.length > 0) {
        setActiveDay(parsed[0].weekday)
      }
      setOcrStatus(`OCR complete! Found ${parsed.length} candidate subjects.`)
      await worker.terminate()
    } catch (err) {
      setOcrStatus(`OCR error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setOcrRunning(false)
    }
  }

  // Days present in the imported candidates
  const detectedDays = useMemo(() => {
    const daySet = new Set<number>()
    for (const c of candidates) {
      if (c.weekday >= 0 && c.weekday <= 6) {
        daySet.add(c.weekday)
      }
    }
    // If fewer than 5 days, still include weekdays Mon-Fri if empty
    if (daySet.size === 0) {
      return [1, 2, 3, 4, 5]
    }
    const list = Array.from(daySet)
    // Sort starting with Monday (1..6, 0)
    list.sort((a, b) => {
      const aAdj = a === 0 ? 7 : a
      const bAdj = b === 0 ? 7 : b
      return aAdj - bAdj
    })
    return list
  }, [candidates])

  // Automatically keep activeDay valid if days change
  useEffect(() => {
    if (detectedDays.length > 0 && !detectedDays.includes(activeDay)) {
      setActiveDay(detectedDays[0])
    }
  }, [detectedDays, activeDay])

  // Filter candidates for currently selected day
  const dayCandidatesWithIndices = useMemo(() => {
    return candidates
      .map((c, originalIndex) => ({ candidate: c, originalIndex }))
      .filter(({ candidate }) => candidate.weekday === activeDay)
      .sort((a, b) => a.candidate.startTime.localeCompare(b.candidate.startTime))
  }, [candidates, activeDay])

  // Open Subject Modal to add new subject for currently active day
  function handleOpenAddModal() {
    setEditingIndex(null)
    setShowSubjectModal(true)
  }

  // Open Subject Modal to edit existing subject
  function handleOpenEditModal(originalIndex: number) {
    setEditingIndex(originalIndex)
    setShowSubjectModal(true)
  }

  // Save subject from modal (add or edit)
  function handleSaveSubjectFromModal(data: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
  }) {
    const newItem: CandidateClass = {
      title: data.title,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime || '',
      room: data.room || '',
      notes: data.notes || '',
      confidence: 'high'
    }

    if (editingIndex !== null) {
      // Edit existing
      setCandidates(prev => prev.map((item, i) => (i === editingIndex ? newItem : item)))
    } else {
      // Add new
      setCandidates(prev => [...prev, newItem])
    }
    setActiveDay(data.weekday)
  }

  // Safe Delete Request
  function requestDelete(candidate: CandidateClass, originalIndex: number) {
    setDeletingCandidate({ item: candidate, index: originalIndex })
  }

  // Confirm Delete
  function confirmDelete() {
    if (!deletingCandidate) return
    const { item, index } = deletingCandidate

    setCandidates(prev => prev.filter((_, i) => i !== index))
    setDeletingCandidate(null)

    // Set Undo Record
    setUndoRecord({
      item,
      index,
      dayName: WEEKDAYS[item.weekday]
    })
  }

  // Undo Delete
  function handleUndoDelete() {
    if (!undoRecord) return
    const { item, index } = undoRecord

    setCandidates(prev => {
      const copy = [...prev]
      const insertAt = Math.min(index, copy.length)
      copy.splice(insertAt, 0, item)
      return copy
    })
    setActiveDay(item.weekday)
    setUndoRecord(null)
  }

  async function handleFinalSave() {
    setIsSaving(true)
    try {
      await onConfirm(candidates, saveMode)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  // Calculate day-by-day counts for summary
  const dayCounts = detectedDays.map(d => ({
    day: WEEKDAYS[d],
    count: candidates.filter(c => c.weekday === d).length
  }))

  const warningCount = candidates.filter(c => Boolean(c.warning) || c.confidence === 'low').length

  const editingSubjectItem =
    editingIndex !== null && candidates[editingIndex]
      ? {
          id: editingIndex,
          title: candidates[editingIndex].title,
          weekday: candidates[editingIndex].weekday,
          start_time: candidates[editingIndex].startTime,
          end_time: candidates[editingIndex].endTime,
          room: candidates[editingIndex].room,
          notes: candidates[editingIndex].notes
        }
      : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 680, width: '95vw', minHeight: 460 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Import Timetable
            </span>
          </div>
          <button className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        {/* Stepper (1 Upload -> 2 Day-by-Day Review -> 3 Confirm) */}
        <div className="stepper-header">
          <div className={`step-indicator ${currentStep === 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span>Upload</span>
          </div>
          <div style={{ width: 28, height: 1, background: 'var(--border-subtle)' }} />
          <div className={`step-indicator ${currentStep === 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span>Review by Day</span>
          </div>
          <div style={{ width: 28, height: 1, background: 'var(--border-subtle)' }} />
          <div className={`step-indicator ${currentStep === 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ minHeight: 310, maxHeight: '68vh', overflowY: 'auto' }}>
          {/* STEP 1: Upload */}
          {currentStep === 1 && (
            <div
              className="dropzone-box"
              onClick={async () => {
                const res = await window.hello11824.pickAndExtract()
                if (res) {
                  setRawText(res.text || '')
                  setCandidates(res.candidates || [])
                  setCurrentStep(2)
                  if (res.candidates?.length > 0) {
                    setActiveDay(res.candidates[0].weekday)
                  }
                  if (res.needsOcr && res.imageData) runOcr(res.imageData)
                }
              }}
            >
              <FileUp size={44} color="var(--accent-cyan)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Drag & drop your timetable file here
                </span>
                <span style={{ fontSize: 12, color: 'var(--accent-purple)', textDecoration: 'underline' }}>
                  or click to browse files
                </span>
              </div>

              <div className="badge-row">
                {['PDF', 'DOCX', 'PNG', 'JPG', 'JPEG', 'WEBP'].map(fmt => (
                  <span key={fmt} className="format-badge">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Day-by-Day Review Screen */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ocrRunning && (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--accent-cyan)'
                  }}
                >
                  <RefreshCw size={13} className="spin-icon" />
                  <span>{ocrStatus}</span>
                </div>
              )}

              {/* Day Tabs Selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 8,
                  gap: 8,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {detectedDays.map(dayIdx => {
                    const count = candidates.filter(c => c.weekday === dayIdx).length
                    const isSelected = activeDay === dayIdx
                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        className={`day-pill-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => setActiveDay(dayIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          fontSize: 12
                        }}
                      >
                        <span>{WEEKDAYS[dayIdx]}</span>
                        <span
                          style={{
                            background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                            borderRadius: '999px',
                            padding: '1px 6px',
                            fontSize: 10.5
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="btn-pill-action"
                  onClick={handleOpenAddModal}
                >
                  <Plus size={12} /> Add Subject
                </button>
              </div>

              {/* Day Subjects Table */}
              {dayCandidatesWithIndices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  No subjects scheduled for {WEEKDAYS[activeDay]}. Click <strong>+ Add Subject</strong> to schedule one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayCandidatesWithIndices.map(({ candidate, originalIndex }) => {
                    const hasWarning = Boolean(candidate.warning) || candidate.confidence === 'low'

                    return (
                      <div
                        key={originalIndex}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '110px 1.4fr 1fr auto auto',
                          gap: 10,
                          alignItems: 'center',
                          background: hasWarning ? 'var(--priority-med-bg)' : 'var(--bg-card-inner)',
                          border: `1px solid ${hasWarning ? 'var(--priority-med-text)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          <Clock size={12} color="var(--accent-purple)" />
                          <span>
                            {candidate.startTime} – {candidate.endTime || '??'}
                          </span>
                        </div>

                        {/* Subject Title */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: candidate.title ? 'var(--text-primary)' : 'var(--priority-high-text)' }}>
                            {candidate.title || '(Untitled Subject)'}
                          </span>
                          {candidate.warning && (
                            <span style={{ fontSize: 10.5, color: 'var(--priority-med-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={11} /> {candidate.warning}
                            </span>
                          )}
                        </div>

                        {/* Room & Instructor */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>{candidate.room ? `Room: ${candidate.room}` : '—'}</span>
                          {candidate.notes && candidate.notes !== 'Imported class' && (
                            <span style={{ fontSize: 10 }}>{candidate.notes}</span>
                          )}
                        </div>

                        {/* Status / Confidence Badge */}
                        <div>
                          {hasWarning ? (
                            <span
                              style={{
                                background: 'var(--priority-med-bg)',
                                color: 'var(--priority-med-text)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10.5,
                                fontWeight: 600
                              }}
                            >
                              Check
                            </span>
                          ) : (
                            <span
                              style={{
                                background: 'var(--priority-low-bg)',
                                color: 'var(--priority-low-text)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10.5,
                                fontWeight: 600
                              }}
                            >
                              Verified
                            </span>
                          )}
                        </div>

                        {/* Edit and Delete Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="win-btn"
                            style={{ width: 26, height: 26 }}
                            title="Edit subject"
                            onClick={() => handleOpenEditModal(originalIndex)}
                          >
                            <Edit2 size={13} color="var(--text-muted)" />
                          </button>
                          <button
                            type="button"
                            className="win-btn"
                            style={{ width: 26, height: 26 }}
                            title="Delete subject"
                            onClick={() => requestDelete(candidate, originalIndex)}
                          >
                            <Trash2 size={13} color="var(--priority-high-text)" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Summary and Confirmation */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary Card */}
              <div
                style={{
                  background: 'var(--bg-card-inner)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(167, 136, 250, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-purple)'
                    }}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Ready to Save {candidates.length} Subjects
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Extracted from {importResult?.fileName || 'document'}
                    </div>
                  </div>
                </div>

                {/* Day-by-day counts */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                    gap: 8,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  {dayCounts.map(d => (
                    <div
                      key={d.day}
                      style={{
                        background: 'var(--bg-card)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.day}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{d.count}</span>
                    </div>
                  ))}
                </div>

                {warningCount > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--priority-med-bg)',
                      border: '1px solid var(--priority-med-text)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: 'var(--priority-med-text)',
                      fontSize: 12
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>
                      Notice: {warningCount} subject(s) have overlapping or uncertain times. You can go back to review or save anyway.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--priority-low-bg)',
                      border: '1px solid var(--priority-low-text)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: 'var(--priority-low-text)',
                      fontSize: 12
                    }}
                  >
                    <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    <span>All subjects have verified start and end times without conflicts.</span>
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Select Save Option:
                </span>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    background: saveMode === 'append' ? 'var(--accent-purple-bg)' : 'var(--bg-card-inner)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${saveMode === 'append' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === 'append'}
                    onChange={() => setSaveMode('append')}
                    style={{ accentColor: 'var(--accent-purple)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Append to Existing Timetable
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Preserves your current timetable and adds these new reviewed subjects.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    background: saveMode === 'replace' ? 'var(--accent-purple-bg)' : 'var(--bg-card-inner)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${saveMode === 'replace' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === 'replace'}
                    onChange={() => setSaveMode('replace')}
                    style={{ accentColor: 'var(--accent-purple)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Replace Existing Timetable
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Replaces all current subjects with this new schedule.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn-secondary-pill"
            onClick={() => {
              if (currentStep > 1) setCurrentStep((currentStep - 1) as any)
              else onClose()
            }}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              className="btn-primary-pill"
              onClick={() => setCurrentStep((currentStep + 1) as any)}
              disabled={currentStep === 2 && candidates.length === 0}
            >
              Continue to Confirm
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary-pill"
              onClick={handleFinalSave}
              disabled={isSaving || candidates.length === 0}
            >
              {isSaving ? 'Saving…' : 'Save Timetable'}
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Subject Modal */}
      <SubjectModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjectItem={editingSubjectItem}
        defaultWeekday={activeDay}
        availableDays={detectedDays}
        onSave={handleSaveSubjectFromModal}
      />

      {/* Safe Deletion Confirmation Dialog */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingCandidate)}
        title="Delete Subject"
        subjectTitle={deletingCandidate?.item.title || ''}
        timeRange={`${deletingCandidate?.item.startTime || ''} – ${deletingCandidate?.item.endTime || ''}`}
        dayName={deletingCandidate ? WEEKDAYS[deletingCandidate.item.weekday] : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingCandidate(null)}
      />

      {/* Undo Toast Notification (60s timer) */}
      {undoRecord && (
        <UndoToast
          message={`Subject deleted: "${undoRecord.item.title}"`}
          details={`(${undoRecord.item.startTime} – ${undoRecord.item.endTime}) from ${undoRecord.dayName}`}
          onUndo={handleUndoDelete}
          onDismiss={() => setUndoRecord(null)}
          durationMs={60_000}
        />
      )}
    </div>
  )
}
