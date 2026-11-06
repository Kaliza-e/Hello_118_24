import { useState, useEffect, useMemo } from 'react'
import {
  Heart,
  Sparkles,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Save,
  Smile,
  BookOpen,
  Check
} from 'lucide-react'
import {
  BibleTranslation,
  ScriptureVerse,
  getDailyVerse,
  getVersesByMood,
  SCRIPTURE_VERSES
} from '../../../shared/scriptureData'
import { JournalEntry, toDateKey } from '../types'

interface FaithJournalCardProps {
  today: Date
  onShowMessage: (msg: string) => void
}

const MOOD_OPTIONS = [
  { id: 'peace', label: '🕊️ Peace', desc: 'Anxious / Stressed' },
  { id: 'strength', label: '💪 Strength', desc: 'Tired / Drained' },
  { id: 'gratitude', label: '🙏 Gratitude', desc: 'Thankful / Blessed' },
  { id: 'hope', label: '🌅 Hope', desc: 'Discouraged' },
  { id: 'focus', label: '🎯 Focus', desc: 'Seeking Wisdom' }
] as const

export function FaithJournalCard({ today, onShowMessage }: FaithJournalCardProps) {
  const todayKey = toDateKey(today)
  const [translation, setTranslation] = useState<BibleTranslation>('KJV')
  const [faithEnabled, setFaithEnabled] = useState(true)
  const [journalEnabled, setJournalEnabled] = useState(true)

  // Mood verse selector
  const [activeMood, setActiveMood] = useState<'peace' | 'strength' | 'gratitude' | 'hope' | 'focus' | null>(null)

  // Journal form state
  const isEvening = today.getHours() >= 17
  const [journalType, setJournalType] = useState<'morning' | 'evening'>(isEvening ? 'evening' : 'morning')
  const [isJournalOpen, setIsJournalOpen] = useState(false)
  const [gratitude, setGratitude] = useState('')
  const [intention, setIntention] = useState('')
  const [reflection, setReflection] = useState('')
  const [moodTag, setMoodTag] = useState('peaceful')
  const [isSaving, setIsSaving] = useState(false)

  // Load preferences from SQLite
  useEffect(() => {
    window.hello11824?.getSetting('faith_enabled').then(val => {
      if (val !== null) setFaithEnabled(val !== 'false')
    })
    window.hello11824?.getSetting('journal_enabled').then(val => {
      if (val !== null) setJournalEnabled(val !== 'false')
    })
    window.hello11824?.getSetting('bible_translation').then(val => {
      if (val === 'KJV' || val === 'NIV' || val === 'ESV' || val === 'NLT') {
        setTranslation(val)
      }
    })
  }, [])

  // Load journal entry for today
  useEffect(() => {
    if (!journalEnabled) return
    window.hello11824?.getJournalEntry(todayKey, journalType).then(entry => {
      if (entry) {
        setGratitude(entry.gratitude || '')
        setIntention(entry.intention || '')
        setReflection(entry.reflection || '')
        if (entry.mood) setMoodTag(entry.mood)
      } else {
        setGratitude('')
        setIntention('')
        setReflection('')
      }
    })
  }, [todayKey, journalType, journalEnabled])

  // Current active verse
  const displayedVerse = useMemo<ScriptureVerse>(() => {
    if (activeMood) {
      const moodList = getVersesByMood(activeMood)
      return moodList[0] || getDailyVerse(today)
    }
    return getDailyVerse(today)
  }, [activeMood, today])

  async function handleSaveJournal() {
    setIsSaving(true)
    try {
      await window.hello11824.saveJournalEntry(todayKey, journalType, {
        gratitude: gratitude.trim() || undefined,
        intention: intention.trim() || undefined,
        reflection: reflection.trim() || undefined,
        mood: moodTag
      })
      onShowMessage(`${journalType === 'morning' ? 'Morning' : 'Evening'} check-in saved securely.`)
      setIsJournalOpen(false)
    } catch (err) {
      onShowMessage(`Failed to save check-in: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTranslationChange(newTr: BibleTranslation) {
    setTranslation(newTr)
    await window.hello11824?.setSetting('bible_translation', newTr)
  }

  if (!faithEnabled) {
    return null
  }

  const verseText = displayedVerse.translations[translation] || displayedVerse.translations['KJV']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Daily Rotating Verse Card */}
      <div
        className="app-card"
        style={{
          padding: '14px 16px',
          background: 'var(--bg-quote)',
          border: '1px solid var(--border-card)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Heart size={14} fill="var(--accent-purple)" color="var(--accent-purple)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)' }}>
              Daily Scripture • {displayedVerse.reference}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['KJV', 'NIV', 'ESV', 'NLT'] as const).map(tr => (
              <button
                key={tr}
                type="button"
                className={`day-pill-btn ${translation === tr ? 'active' : ''}`}
                style={{ padding: '2px 7px', fontSize: 10, minWidth: 32 }}
                onClick={() => handleTranslationChange(tr)}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)', fontStyle: 'italic', margin: '4px 0 8px 0' }}>
          “{verseText}”
        </p>

        {/* Verse by Mood Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Verses for how you feel:</span>
            {MOOD_OPTIONS.map(m => (
              <button
                key={m.id}
                type="button"
                className={`day-pill-btn ${activeMood === m.id ? 'active' : ''}`}
                style={{ padding: '2px 8px', fontSize: 10.5 }}
                onClick={() => setActiveMood(prev => (prev === m.id ? null : m.id))}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Collapsible Journal Trigger */}
          {journalEnabled && (
            <button
              type="button"
              className="btn-secondary-pill"
              style={{ fontSize: 10.5, padding: '3px 8px', gap: 4 }}
              onClick={() => setIsJournalOpen(prev => !prev)}
            >
              {journalType === 'morning' ? <Sun size={11} color="var(--dot-orange)" /> : <Moon size={11} color="var(--accent-purple)" />}
              <span>{isEvening ? 'Evening Reflection' : 'Morning Intention'}</span>
              {isJournalOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>

        {/* Collapsible Journal Form */}
        {journalEnabled && isJournalOpen && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`day-pill-btn ${journalType === 'morning' ? 'active' : ''}`}
                  onClick={() => setJournalType('morning')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}
                >
                  <Sun size={11} /> Morning Check-In
                </button>
                <button
                  type="button"
                  className={`day-pill-btn ${journalType === 'evening' ? 'active' : ''}`}
                  onClick={() => setJournalType('evening')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}
                >
                  <Moon size={11} /> Evening Check-In
                </button>
              </div>

              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒 Private & encrypted at rest</span>
            </div>

            {journalType === 'morning' ? (
              <>
                <div>
                  <label className="input-label" style={{ fontSize: 11 }}>What are you grateful for this morning?</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. A good night's rest, fresh coffee, family..."
                    value={gratitude}
                    onChange={e => setGratitude(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: 11 }}>Today's main intention or focus:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Stay patient during math revision, listen actively..."
                    value={intention}
                    onChange={e => setIntention(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="input-label" style={{ fontSize: 11 }}>What went well today?</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Finished Chapter 4 notes, stayed focused for 90 minutes..."
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: 11 }}>One lesson or blessing from today:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Consistent small steps beat rushing at the end..."
                    value={gratitude}
                    onChange={e => setGratitude(e.target.value)}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="btn-primary-pill"
                style={{ background: 'var(--accent-purple-btn)', fontSize: 11, padding: '4px 12px' }}
                onClick={handleSaveJournal}
                disabled={isSaving}
              >
                <Save size={11} /> {isSaving ? 'Saving...' : 'Save Check-In'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
