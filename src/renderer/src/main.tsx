import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initBrowserFallback } from './lib/browserMock'
import './styles.css'

// Ensure browser fallback is registered if opened in Chrome/Edge rather than Electron
initBrowserFallback()

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
