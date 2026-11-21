import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { MessageCircle, X } from 'lucide-react'
import { closeRegistration } from '../windows'
import { Button } from './ui'

export function Register() {
  const [status, setStatus] = useState('')
  const desktop = isTauri()

  return (
    <main className={desktop ? 'min-h-dvh' : 'grid min-h-dvh place-items-center p-3 sm:p-5'}>
      <section aria-labelledby="register-title"
        className={`w-full overflow-hidden border border-neutral-700 bg-[#121212] ${desktop ? 'min-h-dvh' : 'max-w-[444px] rounded-[15px] shadow-[0_0_28px_rgb(251_191_36/0.17)]'}`}>
        <header data-tauri-drag-region={desktop ? '' : undefined}
          className="flex select-none items-center justify-between border-b border-neutral-800 bg-neutral-900 px-3.5 py-2">
          <p className={`flex items-center gap-2 text-sm font-medium ${desktop ? 'pointer-events-none' : ''}`}><span className="grid size-6 place-items-center rounded-lg bg-amber-400 text-neutral-950"><MessageCircle size={13} /></span>Реплика</p>
          <Button className="min-h-8 px-2" aria-label="Закрыть регистрацию" onClick={() => void closeRegistration().catch(() => setStatus('Не удалось закрыть окно.'))}><X size={15} /></Button>
        </header>
        <div className="px-5 pt-4 pb-2 sm:px-10">
          <h1 id="register-title" className="sr-only">Регистрация</h1>
          <p id="register-help" className="text-center text-xs text-neutral-400">Демо-форма. Используйте вымышленные данные.</p>
          <form aria-describedby="register-help" className="registration-stack mx-auto max-w-[336px]" onSubmit={(event) => {
            event.preventDefault()
            event.currentTarget.reset()
            setStatus('Данные формы прошли проверку.')
          }} onInput={() => setStatus('')}>
            <label className="registration-slab [--slab:var(--color-green-100)]">
              <input className="registration-row" aria-label="Имя" placeholder="Имя" required maxLength={80} />
            </label>
            <label className="registration-slab [--slab:var(--color-green-200)]">
              <input className="registration-row" aria-label="Электронная почта" placeholder="Электронная почта" type="email" required maxLength={254} />
            </label>
            <label className="registration-slab [--slab:var(--color-green-300)]">
              <input className="registration-row" aria-label="Пароль" placeholder="Пароль" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
            </label>
            <div className="registration-slab [--slab:#12a422]">
              <button type="submit" className="registration-row font-medium">Создать аккаунт</button>
            </div>
          </form>
          <p role="status" className="min-h-5 text-center text-xs text-green-300">{status}</p>
        </div>
      </section>
    </main>
  )
}
