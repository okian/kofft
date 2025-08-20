import React from 'react'
import { X } from 'lucide-react'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

const groups = [
  {
    title: 'Playback',
    items: [
      { keys: 'Space / K', desc: 'Play/Pause' },
      { keys: 'J', desc: 'Seek backward 10s' },
      { keys: 'L', desc: 'Seek forward 10s' },
      { keys: '←', desc: 'Seek backward 5s' },
      { keys: '→', desc: 'Seek forward 5s' },
    ]
  },
  {
    title: 'Navigation',
    items: [
      { keys: 'Ctrl+←', desc: 'Previous track' },
      { keys: 'Ctrl+→', desc: 'Next track' },
    ]
  },
  {
    title: 'Panels',
    items: [
      { keys: 'M', desc: 'Mute/unmute' },
      { keys: 'I', desc: 'Toggle metadata panel' },
      { keys: 'P', desc: 'Toggle playlist panel' },
      { keys: 'S', desc: 'Open settings' },
    ]
  },
  {
    title: 'Other',
    items: [
      { keys: 'Ctrl+Shift+S', desc: 'Take snapshot' },
      { keys: '?', desc: 'Show this help' },
    ]
  }
]

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" data-testid="shortcuts-modal">
      <div className="bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button onClick={onClose} className="icon-btn" title="Close (Esc)">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-6">
          {groups.map(group => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-neutral-400 mb-2">{group.title}</h3>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
                {group.items.map(item => (
                  <React.Fragment key={item.keys}>
                    <kbd className="px-2 py-1 bg-neutral-800 rounded text-neutral-200 whitespace-nowrap">{item.keys}</kbd>
                    <span className="text-neutral-300">{item.desc}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShortcutsModal
