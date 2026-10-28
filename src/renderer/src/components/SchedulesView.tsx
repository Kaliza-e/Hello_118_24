import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Plus,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Bell,
  Trash2,
  FileText,
  AlertCircle,
  CalendarDays,
  FolderOpen,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react'
import {
  ScheduleEvent,
  ScheduleCategory,
  SCHEDULE_CATEGORIES,
  SourceDocument,
  ScheduleIngestionResult,
  CandidateScheduleEvent
} from '../types'
import { ScheduleEventModal } from './ScheduleEventModal'
import { ScheduleReviewModal } from './ScheduleReviewModal'

interface SchedulesViewProps {
  onShowMessage: (msg: string) => void
}

export function SchedulesView({ onShowMessage }: SchedulesViewProps) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [sourceDocs, setSourceDocs] = useState<SourceDocument[]>([])
  const [loading, setLoading] = useState(true)

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'all' | 'this_week' | 'this_month' | 'past'>('upcoming')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'completed'>('active')
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)

  // Modals & Drawers
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [currentIngestion, setCurrentIngestion] = useState<ScheduleIngestionResult | null>(null)
  const [isDocsDrawerOpen, setIsDocsDrawerOpen] = useState(false)

  // Load events and source documents
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [evList, docs] = await Promise.all([
        window.hello11824.listScheduleEvents({
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          sourceDocId: selectedDocId ?? undefined,
          isCompleted: statusFilter === 'active' ? false : (statusFilter === 'completed' ? true : undefined),
          search: searchQuery.trim() || undefined
        }),
        window.hello11824.listSourceDocuments()
      ])
      setEvents(evList)
      setSourceDocs(docs)
    } catch (err) {
      console.error('Failed to load schedule events:', err)
      onShowMessage(`Error loading schedules: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedDocId, statusFilter, searchQuery, onShowMessage])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Date filtering in memory
  const filteredEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()

    return events.filter(ev => {
      if (dateFilter === 'all') return true
      if (dateFilter === 'upcoming') {
        const target = ev.end_date || ev.start_date
        return target >= today
      }
      if (dateFilter === 'past') {
        const target = ev.end_date || ev.start_date
        return target < today
      }
      if (dateFilter === 'this_week') {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const s = weekStart.toISOString().slice(0, 10)
        const e = weekEnd.toISOString().slice(0, 10)
        return ev.start_date >= s && ev.start_date <= e
      }
      if (dateFilter === 'this_month') {
        const monthPrefix = today.slice(0, 7) // YYYY-MM
        return ev.start_date.startsWith(monthPrefix)
      }
      return true
    })
  }, [events, dateFilter])

  // Group events by Month for display
  const groupedEvents = useMemo(() => {
    const groups: Record<string, ScheduleEvent[]> = {}
    for (const ev of filteredEvents) {
      const yearMonth = ev.start_date.slice(0, 7) // e.g. "2026-09"
      if (!groups[yearMonth]) groups[yearMonth] = []
      groups[yearMonth].push(ev)
    }
    return groups
  }, [filteredEvents])

  // Ingest file dialog
  async function handleImportDocument() {
    try {
      const res = await window.hello11824.pickAndIngestSchedule()
      if (!res) return // Canceled

      setCurrentIngestion(res)
      setIsReviewModalOpen(true)
    } catch (err) {
      onShowMessage(`Import error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Confirm review and save batch
  async function handleConfirmReview(
    candidatesToSave: CandidateScheduleEvent[],
    documentMeta?: {
      fileName: string
      fileHash: string
      fileType: string
      fileSize: number
      rawText?: string
    }
  ) {
    try {
      const res = await window.hello11824.batchSaveScheduleEvents({
        documentMeta,
        events: candidatesToSave
      })
      onShowMessage(`Successfully saved ${res.savedCount} schedule events!`)
      loadData()
    } catch (err) {
      onShowMessage(`Save error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Toggle complete
  async function handleToggleCompleted(id: number) {
    try {
      await window.hello11824.toggleScheduleEventCompleted(id)
      loadData()
    } catch (err) {
      onShowMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Delete event
  async function handleDeleteEvent(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this schedule event?')) return
    try {
      await window.hello11824.deleteScheduleEvent(id)
      onShowMessage('Event deleted.')
      loadData()
    } catch (err) {
      onShowMessage(`Delete error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Save event from modal
  async function handleSaveEvent(
    data: Partial<ScheduleEvent>,
    reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
  ) {
    try {
      if (editingEvent?.id) {
        await window.hello11824.updateScheduleEvent(editingEvent.id, data, reminders)
        onShowMessage('Schedule event updated.')
      } else {
        await window.hello11824.addScheduleEvent(data, reminders)
        onShowMessage('New schedule event added.')
      }
      loadData()
    } catch (err) {
      onShowMessage(`Save error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Delete source document
  async function handleDeleteSourceDoc(id: number) {
    if (!confirm('Delete this source document record and all its associated events?')) return
    try {
      await window.hello11824.deleteSourceDocument(id, true)
      onShowMessage('Source document and its events removed.')
      if (selectedDocId === id) setSelectedDocId(null)
      loadData()
    } catch (err) {
      onShowMessage(`Delete error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function getCategoryColor(cat: ScheduleCategory): string {
    switch (cat) {
      case 'Exams':
        return '#f43f5e' // Rose
      case 'Academic Calendar':
        return '#818cf8' // Indigo
      case 'Assignments':
        return '#f59e0b' // Amber
      case 'Meetings':
        return '#06b6d4' // Cyan
      case 'Workshops':
        return '#a855f7' // Purple
      case 'Events':
        return '#10b981' // Emerald
      case 'Applications':
        return '#3b82f6' // Blue
      case 'Personal':
        return '#ec4899' // Pink
      default:
        return 'var(--text-muted)'
    }
  }

  function formatMonthHeader(yearMonth: string): string {
    const [y, m] = yearMonth.split('-').map(Number)
    const date = new Date(y, m - 1, 1)
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  return (
    <div className="schedules-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={handleImportDocument}
          >
            <Upload size={13} /> Import Schedule
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => {
              setEditingEvent(null)
              setIsEventModalOpen(true)
            }}
          >
            <Plus size={13} /> New Event
          </button>
          <button
            type="button"
            className={`btn-secondary ${isDocsDrawerOpen ? 'active' : ''}`}
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setIsDocsDrawerOpen(prev => !prev)}
            title="View imported source documents"
          >
            <FolderOpen size={13} /> Documents ({sourceDocs.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 26, fontSize: 12, height: 30 }}
            placeholder="Search events, exams, rooms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-btn-subtle"
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        {/* Date Filter */}
        <div style={{ display: 'flex', background: 'var(--bg-card-subtle)', borderRadius: 6, padding: 2, border: '1px solid var(--border-subtle)' }}>
          {(['upcoming', 'this_week', 'this_month', 'all', 'past'] as const).map(df => (
            <button
              key={df}
              type="button"
              className={`filter-pill ${dateFilter === df ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => setDateFilter(df)}
            >
              {df === 'upcoming' ? 'Upcoming' : df === 'this_week' ? 'This Week' : df === 'this_month' ? 'This Month' : df === 'all' ? 'All' : 'Past'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', background: 'var(--bg-card-subtle)', borderRadius: 6, padding: 2, border: '1px solid var(--border-subtle)' }}>
          {(['active', 'completed', 'all'] as const).map(sf => (
            <button
              key={sf}
              type="button"
              className={`filter-pill ${statusFilter === sf ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => setStatusFilter(sf)}
            >
              {sf === 'active' ? 'Active' : sf === 'completed' ? 'Completed' : 'Both'}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <select
          className="inline-select"
          style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 6 }}
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {SCHEDULE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {selectedDocId && (
          <span
            className="filter-pill active"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
          >
            Doc: {sourceDocs.find(d => d.id === selectedDocId)?.file_name || selectedDocId}
            <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedDocId(null)} />
          </span>
        )}
      </div>

      {/* Main Layout: Timeline + Optional Docs Drawer */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Events Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              Loading schedules...
            </div>
          ) : Object.keys(groupedEvents).length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '48px 16px', background: 'var(--bg-card-subtle)', borderRadius: 10, border: '1px dashed var(--border-subtle)' }}>
              <CalendarDays size={32} color="var(--accent-cyan)" style={{ opacity: 0.6, marginBottom: 8 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>No scheduled events found</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px 0', maxWidth: 360 }}>
                Import an academic calendar, continuous assessment timetable, or document to populate this timeline.
              </p>
              <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={handleImportDocument}>
                <Upload size={13} /> Import First Schedule
              </button>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([yearMonth, monthEvents]) => (
              <div key={yearMonth} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Month Sticky Header */}
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{formatMonthHeader(yearMonth)}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {monthEvents.length} event{monthEvents.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Event Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {monthEvents.map(ev => {
                    const isDone = Boolean(ev.is_completed)
                    const catColor = getCategoryColor(ev.category)
                    const hasReminders = Boolean(ev.reminders && ev.reminders.length > 0)

                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setEditingEvent(ev)
                          setIsEventModalOpen(true)
                        }}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease',
                          opacity: isDone ? 0.65 : 1
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      >
                        {/* Completion Checkbox */}
                        <button
                          type="button"
                          className="icon-btn-subtle"
                          style={{ padding: 2, marginTop: 1, color: isDone ? 'var(--priority-low-text)' : 'var(--text-muted)' }}
                          onClick={e => {
                            e.stopPropagation()
                            handleToggleCompleted(ev.id)
                          }}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>

                        {/* Event Content */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                textDecoration: isDone ? 'line-through' : 'none'
                              }}
                            >
                              {ev.title}
                            </span>

                            {/* Category Pill */}
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: `${catColor}20`,
                                color: catColor
                              }}
                            >
                              {ev.category}
                            </span>

                            {hasReminders && (
                              <span title={`${ev.reminders!.length} reminder(s)`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--accent-purple)' }}>
                                <Bell size={11} /> {ev.reminders!.length}
                              </span>
                            )}
                          </div>

                          {/* Time & Dates Row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={11} color="var(--accent-cyan)" />
                              <span>
                                {ev.start_date}
                                {ev.end_date && ev.end_date !== ev.start_date ? ` to ${ev.end_date}` : ''}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} />
                              <span>
                                {ev.is_all_day
                                  ? 'All Day'
                                  : `${ev.start_time || ''}${ev.end_time ? ` - ${ev.end_time}` : ''}`}
                              </span>
                            </div>

                            {ev.location && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={11} color="var(--priority-normal-text)" />
                                <span>{ev.location}</span>
                              </div>
                            )}

                            {ev.source_document_name && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                                <FileText size={11} />
                                <span>{ev.source_document_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Description preview if present */}
                          {ev.description && (
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, maxWidth: 600 }}>
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {/* Quick Delete Button */}
                        <button
                          type="button"
                          className="icon-btn-subtle danger"
                          onClick={e => handleDeleteEvent(ev.id, e)}
                          title="Delete Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Source Documents Drawer */}
        {isDocsDrawerOpen && (
          <div
            style={{
              width: 280,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                <FolderOpen size={14} color="var(--accent-cyan)" />
                <span>Imported Documents</span>
              </div>
              <button type="button" className="icon-btn-subtle" onClick={() => setIsDocsDrawerOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {sourceDocs.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                No documents imported yet.
              </span>
            ) : (
              sourceDocs.map(doc => {
                const isSelected = selectedDocId === doc.id
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isSelected ? 'var(--bg-card-subtle)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {doc.file_name}
                      </span>
                      <button
                        type="button"
                        className="icon-btn-subtle danger"
                        onClick={e => {
                          e.stopPropagation()
                          handleDeleteSourceDoc(doc.id)
                        }}
                        title="Delete document and events"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{doc.event_count} events</span>
                      <span>{new Date(doc.imported_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {isReviewModalOpen && currentIngestion && (
        <ScheduleReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false)
            setCurrentIngestion(null)
          }}
          ingestionResult={currentIngestion}
          onConfirmSave={handleConfirmReview}
        />
      )}

      {/* Event Create / Edit Modal */}
      {isEventModalOpen && (
        <ScheduleEventModal
          isOpen={isEventModalOpen}
          onClose={() => {
            setIsEventModalOpen(false)
            setEditingEvent(null)
          }}
          initialEvent={editingEvent}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  )
}

