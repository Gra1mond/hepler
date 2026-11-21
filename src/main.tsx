import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles.css'
import { App } from './App'
import { createDemoBackend } from './backend'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <App backend={createDemoBackend()} storage={window.localStorage} />
  </StrictMode>,
)
