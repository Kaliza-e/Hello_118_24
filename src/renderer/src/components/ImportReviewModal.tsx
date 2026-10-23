import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  FileUp,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { CandidateClass, WEEKDAYS, ImportResult } from '../types'

interface ImportReviewModalProps {
  isOpen: boolean
  onClose: () => void
  importResult: ImportResult | null
  onConfirm: (classes: CandidateClass[], mode: 'replace' | 'append') => Promise<void>
}

export function ImportReviewModal({ isOpen, onClose, importResult, onConfirm }: ImportReviewModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [candidates, setCandidates] = useState<CandidateClass[]>([])
  const [rawText, setRawText] = useState('')
  const [saveMode, setSaveMode] = useState<'replace' | 'append'>('append')
  const [isSaving, setIsSaving] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrStatus, setOcrStatus] = useState('')

  useEffect(() => {
    if (!importResult) {
      setCurrentStep(1)
      setCandidates([])
      setRawText('')
      return
    }

    setRawText(importResult.text || '')
    setCandidates(importResult.candidates || [])

    // If an importResult was picked via native dialog, advance directly to Step 2 (Review)
    if (importResult.candidates?.length > 0 || importResult.needsOcr) {
      setCurrentStep(2)
    }

    if (importResult.needsOcr && importResult.imageData) {
      runOcr(importResult.imageData)
    }
  }, [importResult, isOpen])

  async function runOcr(imageData: string) {
    setOcrRunning(true)
    setOcrStatus('Scanning timetable image with OCR…')
    try {
      const worker = await createWorker('eng')
      const ret = await worker.recognize(imageData)
      const text = ret.data.text
      setRawText(text)

      const parsed = await window.hello11824.parseText(text)
      setCandidates(parsed)
      setOcrStatus(`OCR complete! Found ${parsed.length} candidate classes.`)
      await worker.terminate()
    } catch (err) {
      setOcrStatus(`OCR error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setOcrRunning(false)
    }
  }

  if (!isOpen) return null

  function updateRow(index: number, field: keyof CandidateClass, value: any) {
    setCandidates(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function deleteRow(index: number) {
    setCandidates(prev => prev.filter((_, i) => i !== index))
  }

  function addRow() {
    setCandidates(prev => [
      ...prev,
      {
        title: 'New Class',
        weekday: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: '',
        notes: ''
      }
    ])
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Import Timetable</span>
          <button className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        {/* Stepper (1 Upload -> 2 Review -> 3 Confirm) */}
        <div className="stepper-header">
          <div className={`step-indicator ${currentStep === 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span>Upload</span>
          </div>
          <div style={{ width: 24, height: 1, background: 'var(--border-subtle)' }} />
          <div className={`step-indicator ${currentStep === 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span>Review</span>
          </div>
          <div style={{ width: 24, height: 1, background: 'var(--border-subtle)' }} />
          <div className={`step-indicator ${currentStep === 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ minHeight: 280, maxHeight: '65vh' }}>
          {/* STEP 1: Upload Dropzone */}
          {currentStep === 1 && (
            <div
              className="dropzone-box"
              onClick={async () => {
                const res = await window.hello11824.pickAndExtract()
                if (res) {
                  setRawText(res.text || '')
                  setCandidates(res.candidates || [])
                  setCurrentStep(2)
                  if (res.needsOcr && res.imageData) runOcr(res.imageData)
                }
              }}
            >
              <FileUp size={44} color="var(--accent-cyan)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  Drag & drop your file here
                </span>
                <span style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'underline' }}>
                  or click to browse
                </span>
              </div>

              <div className="badge-row">
                {['PDF', 'DOCX', 'PNG', 'JPG', 'JPEG'].map(fmt => (
                  <span key={fmt} className="format-badge">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Review Table */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ocrRunning && (
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 10, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-cyan)' }}>
                  <RefreshCw size={13} className="spin" />
                  <span>{ocrStatus}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Extracted {candidates.length} classes from <strong>{importResult?.fileName || 'document'}</strong>
                </span>
                <button className="btn-pill-action" onClick={addRow}>
                  <Plus size={12} /> Add Row
                </button>
              </div>

              {candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                  No classes detected yet. Click "Add Row" or re-scan your document.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 220 }}>
                  {candidates.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto',
                        gap: 6,
                        alignItems: 'center',
                        background: 'rgba(12, 18, 34, 0.65)',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <input
                        className="input-field"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={c.title}
                        onChange={e => updateRow(i, 'title', e.target.value)}
                        placeholder="Subject"
                      />
                      <select
                        className="select-field"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={c.weekday}
                        onChange={e => updateRow(i, 'weekday', Number(e.target.value))}
                      >
                        {WEEKDAYS.map((d, idx) => (
                          <option key={d} value={idx}>
                            {d.slice(0, 3)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        className="input-field"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={c.startTime}
                        onChange={e => updateRow(i, 'startTime', e.target.value)}
                      />
                      <input
                        type="time"
                        className="input-field"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={c.endTime || ''}
                        onChange={e => updateRow(i, 'endTime', e.target.value)}
                      />
                      <input
                        className="input-field"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={c.room || ''}
                        onChange={e => updateRow(i, 'room', e.target.value)}
                        placeholder="Room"
                      />
                      <button
                        className="win-btn"
                        style={{ width: 22, height: 22 }}
                        onClick={() => deleteRow(i)}
                      >
                        <Trash2 size={12} color="var(--priority-high-text)" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Confirm Options */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                How would you like to save these {candidates.length} classes?
              </span>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: 'rgba(12, 18, 34, 0.7)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === 'append'}
                  onChange={() => setSaveMode('append')}
                  style={{ accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
                    Append to Existing Timetable
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Preserves your current classes and adds the new entries.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: 'rgba(12, 18, 34, 0.7)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === 'replace'}
                  onChange={() => setSaveMode('replace')}
                  style={{ accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
                    Replace Existing Timetable
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Replaces all current classes with the reviewed schedule.
                  </div>
                </div>
              </label>
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
            Back
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              className="btn-primary-pill"
              style={{ background: 'var(--accent-purple-btn)' }}
              onClick={() => setCurrentStep((currentStep + 1) as any)}
              disabled={currentStep === 2 && candidates.length === 0}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary-pill"
              style={{ background: 'var(--accent-purple-btn)' }}
              onClick={handleFinalSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save Timetable'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
