import { useState, useMemo, useEffect } from 'react'
import {
  X,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Layers
} from 'lucide-react'
import {
  ScheduleEvent,
  ScheduleCategory,
  SCHEDULE_CATEGORIES,
  CandidateScheduleEvent,
  toDateKey
} from '../types'

interface ScheduleCreatorModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveEvents: (events: CandidateScheduleEvent[]) => Promise<void>
  onShowMessage: (msg: string) => void
  initialTemplate?: TemplateType
  initialSubject?: string
  initialDate?: string
}

type TemplateType = 'study_plan' | 'exam_prep' | 'weekly_plan' | 'custom'

const WEEKDAY_NAMES = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' }
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function ScheduleCreatorModal({
  isOpen,
  onClose,
  onSaveEvents,
  onShowMessage,
  initialTemplate,
  initialSubject,
  initialDate
}: ScheduleCreatorModalProps) {
  if (!isOpen) return null

  const todayStr = toDateKey(new Date())
  const [template, setTemplate] = useState<TemplateType>(initialTemplate || 'study_plan')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ---------- 1. Study Plan Form State ----------
  const [spSubject, setSpSubject] = useState(initialSubject || '')
  const [spStartDate, setSpStartDate] = useState(todayStr)
  const [spEndDate, setSpEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 21) // 3 weeks by default
    return toDateKey(d)
  })
  const [spDays, setSpDays] = useState<number[]>([1, 3, 5]) // Mon, Wed, Fri
  const [spStartTime, setSpStartTime] = useState('16:00')
  const [spDurationMinutes, setSpDurationMinutes] = useState(90)
  const [spMilestoneGoals, setSpMilestoneGoals] = useState('Foundations, Core Exercises, Past Papers Practice')

  // ---------- 2. Exam Prep Form State ----------
  const [epSubject, setEpSubject] = useState(initialSubject || '')
  const [epExamDate, setEpExamDate] = useState(() => {
    if (initialDate) return initialDate
    const d = new Date()
    d.setDate(d.getDate() + 14) // 2 weeks by default
    return toDateKey(d)
  })

  // Synchronize when opened with new initial props
  useEffect(() => {
    if (initialTemplate) setTemplate(initialTemplate)
    if (initialSubject) {
      setEpSubject(initialSubject)
      setSpSubject(initialSubject)
    }
    if (initialDate) {
      setEpExamDate(initialDate)
    }
  }, [initialTemplate, initialSubject, initialDate])
  const [epExamTime, setEpExamTime] = useState('09:00')
  const [epExamEndTime, setEpExamEndTime] = useState('11:30')
  const [epRoom, setEpRoom] = useState('')
  const [epTopics, setEpTopics] = useState(
    'Unit 1: Fundamentals\nUnit 2: Practical Problem Solving\nUnit 3: Advanced Theory & Case Studies\nMock Exam & Timed Practice'
  )

  // ---------- 3. Weekly Recurring Plan Form State ----------
  const [wpTitle, setWpTitle] = useState('')
  const [wpCategory, setWpCategory] = useState<ScheduleCategory>('Workshops')
  const [wpDays, setWpDays] = useState<number[]>([2, 4]) // Tue, Thu
  const [wpStartTime, setWpStartTime] = useState('14:00')
  const [wpEndTime, setWpEndTime] = useState('15:30')
  const [wpLocation, setWpLocation] = useState('')
  const [wpWeeksCount, setWpWeeksCount] = useState(4)

  // ---------- 4. Custom Single Event Form State ----------
  const [ceTitle, setCeTitle] = useState('')
  const [ceCategory, setCeCategory] = useState<ScheduleCategory>('Events')
  const [ceStartDate, setCeStartDate] = useState(todayStr)
  const [ceStartTime, setCeStartTime] = useState('10:00')
  const [ceEndDate, setCeEndDate] = useState(todayStr)
  const [ceEndTime, setCeEndTime] = useState('12:00')
  const [ceIsAllDay, setCeIsAllDay] = useState(false)
  const [ceLocation, setCeLocation] = useState('')
  const [ceDescription, setCeDescription] = useState('')

  // ---------- Generated Preview Candidates ----------
  const previewEvents = useMemo<CandidateScheduleEvent[]>(() => {
    if (template === 'study_plan') {
      if (!spSubject.trim() || !spStartDate || !spEndDate) return []

      const events: CandidateScheduleEvent[] = []
      const [sy, sm, sd] = spStartDate.split('-').map(Number)
      const [ey, em, ed] = spEndDate.split('-').map(Number)
      const current = new Date(sy, sm - 1, sd)
      const end = new Date(ey, em - 1, ed)

      const milestones = spMilestoneGoals
        .split(',')
        .map(m => m.trim())
        .filter(Boolean)

      let sessionIndex = 1
      while (current <= end) {
        const weekday = current.getDay()
        if (spDays.includes(weekday)) {
          const dateStr = toDateKey(current)
          const [sh, smin] = spStartTime.split(':').map(Number)
          const endTotalMins = sh * 60 + smin + spDurationMinutes
          const endH = Math.floor(endTotalMins / 60) % 24
          const endM = endTotalMins % 60
          const endTimeStr = `${pad2(endH)}:${pad2(endM)}`

          const milestoneNote = milestones.length > 0
            ? milestones[(sessionIndex - 1) % milestones.length]
            : undefined

          events.push({
            title: `${spSubject}: Study Session #${sessionIndex}`,
            description: milestoneNote ? `Milestone Focus: ${milestoneNote}` : `Dedicated study block for ${spSubject}`,
            category: 'Study Plan' as ScheduleCategory,
            startDate: dateStr,
            startTime: spStartTime,
            endDate: dateStr,
            endTime: endTimeStr,
            isAllDay: false,
            confidence: 'high'
          })
          sessionIndex++
        }
        current.setDate(current.getDate() + 1)
      }
      return events
    }

    if (template === 'exam_prep') {
      if (!epSubject.trim() || !epExamDate) return []

      const events: CandidateScheduleEvent[] = []
      const topicList = epTopics
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean)

      const [ey, em, ed] = epExamDate.split('-').map(Number)
      const examDate = new Date(ey, em - 1, ed)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const diffDays = Math.max(1, Math.round((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
      const step = Math.max(1, Math.floor(diffDays / (topicList.length || 1)))

      // Distribute revision topics leading up to exam
      topicList.forEach((topic, i) => {
        const prepDate = new Date(today)
        prepDate.setDate(today.getDate() + Math.min(diffDays - 1, (i + 1) * step))
        const prepDateStr = toDateKey(prepDate)

        events.push({
          title: `Revision: ${epSubject} (${topic.replace(/^Unit \d+:\s*/i, '')})`,
          description: `Exam revision for ${epSubject} - ${topic}`,
          category: 'Exams' as ScheduleCategory,
          startDate: prepDateStr,
          startTime: '17:00',
          endDate: prepDateStr,
          endTime: '19:00',
          isAllDay: false,
          confidence: 'high'
        })
      })

      // Add actual Exam Event
      events.push({
        title: `EXAM: ${epSubject}`,
        description: `Final assessment / exam for ${epSubject}${epRoom ? ` in Room ${epRoom}` : ''}`,
        category: 'Exams' as ScheduleCategory,
        startDate: epExamDate,
        startTime: epExamTime || undefined,
        endDate: epExamDate,
        endTime: epExamEndTime || undefined,
        isAllDay: !epExamTime,
        location: epRoom || undefined,
        confidence: 'high'
      })

      return events
    }

    if (template === 'weekly_plan') {
      if (!wpTitle.trim() || wpDays.length === 0) return []

      const events: CandidateScheduleEvent[] = []
      const start = new Date()

      for (let w = 0; w < wpWeeksCount; w++) {
        for (const targetWeekday of wpDays) {
          const d = new Date(start)
          const currentDay = d.getDay()
          const diff = targetWeekday - currentDay
          d.setDate(d.getDate() + diff + w * 7)

          if (d >= start) {
            const dateStr = toDateKey(d)
            events.push({
              title: wpTitle,
              category: wpCategory,
              startDate: dateStr,
              startTime: wpStartTime || undefined,
              endDate: dateStr,
              endTime: wpEndTime || undefined,
              isAllDay: !wpStartTime,
              location: wpLocation || undefined,
              confidence: 'high'
            })
          }
        }
      }
      return events
    }

    // Custom
    if (!ceTitle.trim() || !ceStartDate) return []
    return [
      {
        title: ceTitle,
        category: ceCategory,
        startDate: ceStartDate,
        startTime: ceIsAllDay ? undefined : ceStartTime,
        endDate: ceEndDate || ceStartDate,
        endTime: ceIsAllDay ? undefined : ceEndTime,
        isAllDay: ceIsAllDay,
        location: ceLocation || undefined,
        description: ceDescription || undefined,
        confidence: 'high'
      }
    ]
  }, [
    template,
    spSubject, spStartDate, spEndDate, spDays, spStartTime, spDurationMinutes, spMilestoneGoals,
    epSubject, epExamDate, epExamTime, epExamEndTime, epRoom, epTopics,
    wpTitle, wpCategory, wpDays, wpStartTime, wpEndTime, wpLocation, wpWeeksCount,
    ceTitle, ceCategory, ceStartDate, ceStartTime, ceEndDate, ceEndTime, ceIsAllDay, ceLocation, ceDescription
  ])

  async function handleSave() {
    if (previewEvents.length === 0) {
      onShowMessage('Please fill in the required fields to generate schedule events.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSaveEvents(previewEvents)
      onShowMessage(`Created ${previewEvents.length} schedule events!`)
      onClose()
    } catch (err) {
      console.error('Failed to create schedule:', err)
      onShowMessage(`Failed to create schedule: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleDay(list: number[], setList: (l: number[]) => void, day: number) {
    if (list.includes(day)) {
      setList(list.filter(d => d !== day))
    } else {
      setList([...list, day].sort())
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 620, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} color="var(--accent-purple)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Create Schedule</span>
          </div>
          <button className="win-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Template Selector Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card-inner)' }}>
          <button
            type="button"
            className={`day-pill-btn ${template === 'study_plan' ? 'active' : ''}`}
            onClick={() => setTemplate('study_plan')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <BookOpen size={12} /> Study Plan
          </button>
          <button
            type="button"
            className={`day-pill-btn ${template === 'exam_prep' ? 'active' : ''}`}
            onClick={() => setTemplate('exam_prep')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <GraduationCap size={12} /> Exam Prep
          </button>
          <button
            type="button"
            className={`day-pill-btn ${template === 'weekly_plan' ? 'active' : ''}`}
            onClick={() => setTemplate('weekly_plan')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Calendar size={12} /> Weekly Plan
          </button>
          <button
            type="button"
            className={`day-pill-btn ${template === 'custom' ? 'active' : ''}`}
            onClick={() => setTemplate('custom')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={12} /> Custom
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ================= 1. STUDY PLAN ================= */}
          {template === 'study_plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="input-label">Subject / Focus Area *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Advanced Mathematics, Physics, Data Structures"
                  value={spSubject}
                  onChange={e => setSpSubject(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Start Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={spStartDate}
                    onChange={e => setSpStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">End Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={spEndDate}
                    onChange={e => setSpEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Active Study Days</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {WEEKDAY_NAMES.map(w => (
                    <button
                      key={w.day}
                      type="button"
                      className={`day-pill-btn ${spDays.includes(w.day) ? 'active' : ''}`}
                      style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                      onClick={() => toggleDay(spDays, setSpDays, w.day)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Session Start Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={spStartTime}
                    onChange={e => setSpStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Session Duration (minutes)</label>
                  <input
                    type="number"
                    className="input-field"
                    min={15}
                    step={15}
                    value={spDurationMinutes}
                    onChange={e => setSpDurationMinutes(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Milestones / Topic Chapters (comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Vectors, Differential Calculus, Integration, Past Papers"
                  value={spMilestoneGoals}
                  onChange={e => setSpMilestoneGoals(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ================= 2. EXAM PREP ================= */}
          {template === 'exam_prep' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="input-label">Exam Course / Subject *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Operating Systems Final Exam"
                  value={epSubject}
                  onChange={e => setEpSubject(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="input-label">Exam Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={epExamDate}
                    onChange={e => setEpExamDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Start Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={epExamTime}
                    onChange={e => setEpExamTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">End Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={epExamEndTime}
                    onChange={e => setEpExamEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Exam Room / Venue</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Main Hall 3, Lab A"
                  value={epRoom}
                  onChange={e => setEpRoom(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Revision Topics (one per line, auto-spread across days before the exam)</label>
                <textarea
                  className="textarea-field"
                  rows={4}
                  value={epTopics}
                  onChange={e => setEpTopics(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ================= 3. WEEKLY PLAN ================= */}
          {template === 'weekly_plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Plan Title / Activity *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Robotics Lab Practice, Coding Workshop"
                    value={wpTitle}
                    onChange={e => setWpTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={wpCategory}
                    onChange={e => setWpCategory(e.target.value as ScheduleCategory)}
                  >
                    {SCHEDULE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Recurring Weekdays</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {WEEKDAY_NAMES.map(w => (
                    <button
                      key={w.day}
                      type="button"
                      className={`day-pill-btn ${wpDays.includes(w.day) ? 'active' : ''}`}
                      style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                      onClick={() => toggleDay(wpDays, setWpDays, w.day)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="input-label">Start Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={wpStartTime}
                    onChange={e => setWpStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">End Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={wpEndTime}
                    onChange={e => setWpEndTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Repeat Weeks</label>
                  <input
                    type="number"
                    className="input-field"
                    min={1}
                    max={16}
                    value={wpWeeksCount}
                    onChange={e => setWpWeeksCount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Location / Room</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Innovation Center Lab 2"
                  value={wpLocation}
                  onChange={e => setWpLocation(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ================= 4. CUSTOM EVENT ================= */}
          {template === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Event Title *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Project Submission Deadline"
                    value={ceTitle}
                    onChange={e => setCeTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={ceCategory}
                    onChange={e => setCeCategory(e.target.value as ScheduleCategory)}
                  >
                    {SCHEDULE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="ceAllDay"
                  checked={ceIsAllDay}
                  onChange={e => setCeIsAllDay(e.target.checked)}
                />
                <label htmlFor="ceAllDay" style={{ fontSize: 12, cursor: 'pointer' }}>All Day Event</label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Start Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={ceStartDate}
                    onChange={e => setCeStartDate(e.target.value)}
                  />
                </div>
                {!ceIsAllDay && (
                  <div>
                    <label className="input-label">Start Time</label>
                    <input
                      type="time"
                      className="input-field"
                      value={ceStartTime}
                      onChange={e => setCeStartTime(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">End Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={ceEndDate}
                    onChange={e => setCeEndDate(e.target.value)}
                  />
                </div>
                {!ceIsAllDay && (
                  <div>
                    <label className="input-label">End Time</label>
                    <input
                      type="time"
                      className="input-field"
                      value={ceEndTime}
                      onChange={e => setCeEndTime(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="input-label">Location</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Auditorium"
                  value={ceLocation}
                  onChange={e => setCeLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Description / Notes</label>
                <textarea
                  className="textarea-field"
                  rows={2}
                  placeholder="Add details, links, or expectations..."
                  value={ceDescription}
                  onChange={e => setCeDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Live Generated Preview Section */}
          <div style={{ background: 'var(--bg-card-inner)', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Preview Generated Events ({previewEvents.length})
              </span>
            </div>

            {previewEvents.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0', textAlign: 'center' }}>
                Enter title and dates above to preview generated schedule events.
              </div>
            ) : (
              <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {previewEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      padding: '4px 8px',
                      background: 'var(--bg-card)',
                      borderRadius: 4,
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>{ev.startDate}</span>
                      {ev.startTime && <span style={{ color: 'var(--text-muted)' }}>{ev.startTime}</span>}
                      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </span>
                    </div>
                    <span className="priority-badge-pill medium" style={{ fontSize: 9.5 }}>
                      {ev.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px' }}>
          <button type="button" className="btn-secondary-pill" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-pill"
            onClick={handleSave}
            disabled={isSubmitting || previewEvents.length === 0}
            style={{ background: 'var(--accent-purple-btn)' }}
          >
            <CheckCircle2 size={13} /> {isSubmitting ? 'Saving...' : `Save ${previewEvents.length} Events`}
          </button>
        </div>
      </div>
    </div>
  )
}

