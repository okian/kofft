import toast from 'react-hot-toast'
import { useSettingsStore } from '@/stores/settingsStore'

// Conditional toast function that respects the user's settings
export const conditionalToast = {
  success: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState()
    if (enableToastNotifications) {
      toast.success(message)
    }
  },
  
  error: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState()
    if (enableToastNotifications) {
      toast.error(message)
    }
  },
  
  warning: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState()
    if (enableToastNotifications) {
      toast(message, {
        icon: '⚠️',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      })
    }
  },
  
  info: (message: string) => {
    const { enableToastNotifications } = useSettingsStore.getState()
    if (enableToastNotifications) {
      toast(message, {
        icon: 'ℹ️',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      })
    }
  }
}

// Direct toast functions (always show, regardless of settings)
export const directToast = {
  success: toast.success,
  error: toast.error,
  warning: (message: string) => toast(message, {
    icon: '⚠️',
    style: {
      borderRadius: '10px',
      background: '#333',
      color: '#fff',
    },
  }),
  info: (message: string) => toast(message, {
    icon: 'ℹ️',
    style: {
      borderRadius: '10px',
      background: '#333',
      color: '#fff',
    },
  })
}
