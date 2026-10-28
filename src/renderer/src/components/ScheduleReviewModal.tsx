import { useState, useMemo } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Trash2,
  Plus,
  FileText,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  CopyCheck
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import {
  ScheduleCategory,
  SCHEDULE_CATEGORIES,
  CandidateScheduleEvent,
  ScheduleIngestionResult
} from '../types'

interface ScheduleReviewModalProps {
  isOpen: boolean
  onClose: () => void
  ingestionResult: ScheduleIngestionResult | null
  onConfirmSave: (
    events: CandidateScheduleEvent[],
    documentMeta?: {
      fileName: string
      fileHash: string
      fileType: string
      fileSize: number
      rawText?: string
    }
  ) => Promise<void>
}

export function ScheduleReviewModal({
  isOpen,
  onClose,
  ingestionResult,
  onConfirmSave
}: ScheduleReviewModalProps) {
  if (!isOpen || !ingestionResult) return null

  const [candidates, setCandidates] = useState<CandidateScheduleEvent[]>(() => [
    ...ingestionResult.candidates
  ])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    return new Set(ingestionResult.candidates.map((_, i) => i))
  })
  const [isSaving, setIsSaving] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  // Run OCR on page images if scanned PDF or image
  async function handleRunOcr() {
    if (!ingestionResult?.pageImages || ingestionResult.pageImages.length === 0) return
    setOcrRunning(true)
    setOcrProgress('Initializing OCR engine...')

    try {
      const worker = await createWorker('eng')
      const totalPages = ingestionResult.pageImages.length
      let accumulatedText = ''

      for (let i = 0; i < totalPages; i++) {
        setOcrProgress(`Reading page ${i + 1} of ${totalPages}...`)
        const res = await worker.recognize(ingestionResult.pageImages[i])
        accumulatedText += `\n--- Page ${i + 1} ---\n${res.data.text}\n`
      }

      await worker.terminate()
      setOcrProgress('Analyzing schedule structure...')

      // Parse OCR text via main process
      const parsed = await window.hello11824.parseScheduleText(accumulatedText)
      setCandidates(parsed)
      setSelectedIndices(new Set(parsed.map((_, idx) => idx)))
      setOcrProgress(`OCR complete! Identified ${parsed.length} schedule events.`)
    } catch (err) {
      setOcrProgress(`OCR error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setOcrRunning(false)
    }
  }

  function handleToggleSelect(index: number) {
    setSelectedIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleSelectAll() {
    if (selectedIndices.size === candidates.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(candidates.map((_, i) => i)))
    }
  }

  function handleUpdateCandidate(index: number, updates: Partial<CandidateScheduleEvent>) {
    setCandidates(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  function handleDeleteCandidate(index: number) {
    setCandidates(prev => prev.filter((_, i) => i !== index))
    setSelectedIndices(prev => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
      }
      return next
    })
  }

  function handleAddManualEvent() {
    const todayStr = new Date().toISOString().slice(0, 10)
    const newEvent: CandidateScheduleEvent = {
      title: 'New Scheduled Activity',
      category: 'Academic Calendar',
      startDate: todayStr,
      endDate: todayStr,
      isAllDay: true,
      confidence: 'high'
    }
    setCandidates(prev => [newEvent, ...prev])
    setSelectedIndices(prev => {
      const next = new Set<number>()
      next.add(0)
      for (const i of prev) next.add(i + 1)
      return next
    })
  }

  async function handleConfirm() {
    if (!ingestionResult) return
    const chosen = candidates.filter((_, idx) => selectedIndices.has(idx))
    if (chosen.length === 0) return

    setIsSaving(true)
    try {
      await onConfirmSave(chosen, {
        fileName: ingestionResult.fileName,
        fileHash: ingestionResult.fileHash,
        fileType: ingestionResult.fileType,
        fileSize: ingestionResult.fileSize,
        rawText: ingestionResult.rawText
      })
      onClose()
    } catch (err) {
      alert(`Save error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredCandidates = useMemo(() => {
    return candidates
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (activeFilter === 'all') return true
        return item.confidence === activeFilter
      })
  }, [candidates, activeFilter])

  const highCount = candidates.filter(c => c.confidence === 'high').length
  const mediumCount = candidates.filter(c => c.confidence === 'medium').length
  const lowCount = candidates.filter(c => c.confidence === 'low').length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-container schedule-review-modal" style={{ maxWidth: 860, maxHeight: '90vh' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={18} color="var(--accent-cyan)" />
            <div>
              <h2 className="modal-title">Review Extracted Schedule</h2>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{ingestionResult.fileName}</span>
                <span>•</span>
                <span>{(ingestionResult.fileSize / 1024).toFixed(1)} KB</span>
                {ingestionResult.isDuplicate && (
                  <span className="badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> File Previously Imported
                  </span>
                )}
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn-subtle" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* OCR Trigger Banner if document is scanned */}
        {ingestionResult.needsOcr && ingestionResult.pageImages && (
          <div className="ocr-banner" style={{ background: 'var(--bg-card-subtle)', padding: '10px 14px', borderRadius: 8, margin: '12px 16px 0', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <Sparkles size={16} color="var(--accent-purple)" />
              <div>
                <strong>Scanned Document Detected ({ingestionResult.pageImages.length} page images)</strong>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  {ocrProgress || 'Run OCR layout extraction to parse events from scanned pages.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
              onClick={handleRunOcr}
              disabled={ocrRunning}
            >
              {ocrRunning ? (
                <>
                  <RefreshCw size={12} className="spin-icon" /> Reading...
                </>
              ) : (
                'Run OCR Extraction'
              )}
            </button>
          </div>
        )}

        {/* Summary Bar & Filters */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({candidates.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'high' ? 'active' : ''}`}
              onClick={() => setActiveFilter('high')}
            >
              High ({highCount})
            </button>
            {mediumCount > 0 && (
              <button
                type="button"
                className={`filter-pill ${activeFilter === 'medium' ? 'active' : ''}`}
                onClick={() => setActiveFilter('medium')}
              >
                Medium ({mediumCount})
              </button>
            )}
            {lowCount > 0 && (
              <button
                type="button"
                className={`filter-pill ${activeFilter === 'low' ? 'active' : ''}`}
                onClick={() => setActiveFilter('low')}
              >
                Uncertain ({lowCount})
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={handleSelectAll}
            >
              <CopyCheck size={12} />
              {selectedIndices.size === candidates.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={handleAddManualEvent}
            >
              <Plus size={12} /> Add Event
            </button>
          </div>
        </div>

        {/* Candidates List / Table */}
        <div style={{ padding: '8px 16px', overflowY: 'auto', maxHeight: '50vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              {candidates.length === 0
                ? 'No events identified yet. Click "Run OCR Extraction" or "Add Event" to create activities.'
                : 'No events match the selected confidence filter.'}
            </div>
          ) : (
            filteredCandidates.map(({ item, originalIndex }) => {
              const isSelected = selectedIndices.has(originalIndex)
              return (
                <div
                  key={originalIndex}
                  className={`review-card ${isSelected ? 'selected' : 'unselected'}`}
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(originalIndex)}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-indigo)' }}
                    />

                    {/* Title Input */}
                    <input
                      type="text"
                      value={item.title}
                      onChange={e => handleUpdateCandidate(originalIndex, { title: e.target.value })}
                      className="inline-input"
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        fontSize: 13,
                        background: 'transparent',
                        border: '1px solid transparent',
                        padding: '4px 6px',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="Event Title..."
                    />

                    {/* Category Selector */}
                    <select
                      value={item.category}
                      onChange={e => handleUpdateCandidate(originalIndex, { category: e.target.value as ScheduleCategory })}
                      className="inline-select"
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
                    >
                      {SCHEDULE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Delete action */}
                    <button
                      type="button"
                      className="icon-btn-subtle danger"
                      onClick={() => handleDeleteCandidate(originalIndex)}
                      title="Exclude event"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Dates & Times Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-secondary)', paddingLeft: 24, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={12} color="var(--accent-cyan)" />
                      <span>Start:</span>
                      <input
                        type="date"
                        value={item.startDate}
                        onChange={e => handleUpdateCandidate(originalIndex, { startDate: e.target.value })}
                        className="inline-date-input"
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>End:</span>
                      <input
                        type="date"
                        value={item.endDate || item.startDate}
                        onChange={e => handleUpdateCandidate(originalIndex, { endDate: e.target.value })}
                        className="inline-date-input"
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                      />
                    </div>

                    {/* All-Day or Time */}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={item.isAllDay}
                        onChange={e => handleUpdateCandidate(originalIndex, { isAllDay: e.target.checked })}
                      />
                      <span>All Day</span>
                    </label>

                    {!item.isAllDay && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <input
                          type="time"
                          value={item.startTime || ''}
                          onChange={e => handleUpdateCandidate(originalIndex, { startTime: e.target.value })}
                          className="inline-date-input"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                        />
                        <span>-</span>
                        <input
                          type="time"
                          value={item.endTime || ''}
                          onChange={e => handleUpdateCandidate(originalIndex, { endTime: e.target.value })}
                          className="inline-date-input"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                        />
                      </div>
                    )}

                    {/* Confidence Badge */}
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: item.confidence === 'high' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: item.confidence === 'high' ? 'var(--priority-low-text)' : 'var(--priority-normal-text)'
                      }}
                    >
                      {item.confidence} confidence
                    </span>
                  </div>

                  {/* Evidence / Excerpt */}
                  {item.sourceExcerpt && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4, marginLeft: 24 }}>
                      <FileText size={10} style={{ display: 'inline', marginRight: 4 }} />
                      <em>Source excerpt:</em> “{item.sourceExcerpt}”
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {selectedIndices.size} of {candidates.length} events selected to save
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirm}
              disabled={isSaving || selectedIndices.size === 0}
            >
              {isSaving ? 'Saving to Database...' : `Save ${selectedIndices.size} Events`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
