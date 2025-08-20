import React from 'react'
import ReactDOM from 'react-dom/client'

// @ts-ignore - remote provided at runtime by federation
import('mf_spectrogram/remote').then((remote: any) => {
  const el = document.getElementById('root')!
  if (remote?.mount) remote.mount(el)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div />
  </React.StrictMode>,
)

