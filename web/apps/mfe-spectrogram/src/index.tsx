import React from 'react'
import './index.css'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'

type MountProps = {
  // Future: accept contracts for cross-MFE comms
}

const roots = new Map<Element, ReactDOM.Root>()

export function mount(el: Element, _props?: MountProps) {
  if (roots.has(el)) return
  const root = ReactDOM.createRoot(el)
  roots.set(el, root)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

export function unmount(el: Element) {
  const root = roots.get(el)
  if (!root) return
  root.unmount()
  roots.delete(el)
}

// Local dev support (not required by host)
if (import.meta && (import.meta as any).env?.DEV) {
  const devEl = document.getElementById('root')
  if (devEl) mount(devEl)
}


