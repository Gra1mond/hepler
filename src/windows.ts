import { invoke, isTauri } from '@tauri-apps/api/core'

type SecondaryWindow = 'compact' | 'register'

const windowOptions = {
  compact: { command: 'open_compact_chat', width: 460, height: 680 },
  register: { command: 'open_registration', width: 444, height: 472 },
} as const

export async function openWindow(view: SecondaryWindow) {
  const { command, width, height } = windowOptions[view]
  if (isTauri()) {
    await invoke(command)
    return
  }

  const popup = window.open(`#${view}`, `replica-${view}`, `popup,width=${width},height=${height}`)
  if (!popup) throw new Error('Браузер заблокировал открытие окна.')
  popup.focus()
}

export async function openMain(view: 'chat' | 'settings' | 'materials') {
  if (isTauri()) {
    await invoke('focus_main_window', { view })
    return
  }

  if (window.opener && !window.opener.closed) {
    window.opener.location.hash = view
    window.opener.focus()
    return
  }

  window.location.hash = view
}

export async function closeRegistration() {
  if (isTauri()) await invoke('close_registration')
  else if (window.opener) window.close()
  else window.location.hash = 'profile'
}
