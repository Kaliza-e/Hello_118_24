export type BibleTranslation = 'KJV' | 'NIV' | 'ESV' | 'NLT'

export interface ScriptureVerse {
  reference: string
  translations: Record<BibleTranslation, string>
  theme: string
  moods: Array<'peace' | 'strength' | 'gratitude' | 'hope' | 'focus'>
}

export const SCRIPTURE_VERSES: ScriptureVerse[] = [
  {
    reference: 'Psalm 118:24',
    translations: {
      KJV: 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
      NIV: 'The LORD has done it this very day; let us rejoice today and be glad.',
      ESV: 'This is the day that the LORD has made; let us rejoice and be glad in it.',
      NLT: 'This is the day the LORD has made. We will rejoice and be glad in it.'
    },
    theme: 'Joy & Daily Purpose',
    moods: ['gratitude', 'peace']
  },
  {
    reference: 'Philippians 4:6-7',
    translations: {
      KJV: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
      NIV: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.',
      ESV: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
      NLT: 'Don’t worry about anything; instead, pray about everything. Tell God what you need, and thank him for all he has done. Then you will experience God’s peace, which exceeds anything we can understand.'
    },
    theme: 'Calm & Peace in Stress',
    moods: ['peace']
  },
  {
    reference: 'Isaiah 40:29, 31',
    translations: {
      KJV: 'He giveth power to the faint; and to them that have no might he increaseth strength... they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
      NIV: 'He gives strength to the weary and increases the power of the weak... those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
      ESV: 'He gives power to the faint, and to him who has no might he increases strength... but they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they will walk and not faint.',
      NLT: 'He gives power to the weak and strength to the powerless... But those who trust in the LORD will find new strength. They will soar high on wings like eagles. They will run and not grow weary. They will walk and not faint.'
    },
    theme: 'Renewed Energy & Resilience',
    moods: ['strength']
  },
  {
    reference: 'Joshua 1:9',
    translations: {
      KJV: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
      NIV: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.',
      ESV: 'Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go.',
      NLT: 'This is my command—be strong and courageous! Do not be afraid or discouraged. For the LORD your God is with you wherever you go.'
    },
    theme: 'Courage & Confidence',
    moods: ['hope', 'strength']
  },
  {
    reference: 'James 1:5',
    translations: {
      KJV: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.',
      NIV: 'If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.',
      ESV: 'If any of you lacks wisdom, you should ask God, who gives generously to all without reproach, and it will be given him.',
      NLT: 'If you need wisdom, ask our generous God, and he will give it to you. He will not rebuke you for asking.'
    },
    theme: 'Wisdom & Learning Clarity',
    moods: ['focus']
  },
  {
    reference: 'Proverbs 3:5-6',
    translations: {
      KJV: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
      NIV: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.',
      ESV: 'Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.',
      NLT: 'Trust in the LORD with all your heart; do not depend on your own understanding. Seek his will in all you do, and he will show you which path to take.'
    },
    theme: 'Direction & Guidance',
    moods: ['focus', 'peace']
  },
  {
    reference: 'Colossians 3:23',
    translations: {
      KJV: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;',
      NIV: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters,',
      ESV: 'Whatever you do, work heartily, as for the Lord and not for men,',
      NLT: 'Work willingly at whatever you do, as though you were working for the Lord rather than for people.'
    },
    theme: 'Diligence & Focus in Study',
    moods: ['focus']
  },
  {
    reference: 'Jeremiah 29:11',
    translations: {
      KJV: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
      NIV: '“For I know the plans I have for you,” declares the LORD, “plans to prosper you and not to harm you, plans to give you hope and a future.”',
      ESV: 'For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.',
      NLT: '“For I know the plans I have for you,” says the LORD. “They are plans for good and not for disaster, to give you a future and a hope.”'
    },
    theme: 'Hope & Bright Future',
    moods: ['hope']
  },
  {
    reference: '1 Thessalonians 5:16-18',
    translations: {
      KJV: 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
      NIV: 'Rejoice always, pray continually, give thanks in all circumstances; for this is God’s will for you in Christ Jesus.',
      ESV: 'Rejoice always, pray without ceasing, give thanks in all circumstances; for this is the will of God in Christ Jesus for you.',
      NLT: 'Always be joyful. Never stop praying. Be thankful in all circumstances, for this is God’s will for you who belong to Christ Jesus.'
    },
    theme: 'Gratitude & Joy',
    moods: ['gratitude']
  }
]

export function getDailyVerse(date: Date = new Date()): ScriptureVerse {
  // Rotate deterministically by day of year so each day gets an inspiring verse
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = Math.abs(dayOfYear) % SCRIPTURE_VERSES.length
  return SCRIPTURE_VERSES[index]
}

export function getVersesByMood(mood: 'peace' | 'strength' | 'gratitude' | 'hope' | 'focus'): ScriptureVerse[] {
  return SCRIPTURE_VERSES.filter(v => v.moods.includes(mood))
}

