import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { MessageCircle, X } from 'lucide-react'
import { closeRegistration } from '../windows'
import { Button, Input } from './ui'

export function Register() {
  const [status, setStatus] = useState('')
  const [invalid, setInvalid] = useState(false)
  const desktop = isTauri()

  function dismiss() {
    void closeRegistration().catch(() => {
      setInvalid(true)
      setStatus('Не удалось закрыть окно.')
    })
  }

  return (
    <main className={desktop ? 'min-h-dvh' : 'grid min-h-dvh place-items-center px-3 [@media(min-height:500px)]:py-5'}>
      <section aria-labelledby="register-title" onKeyDown={(event) => {
        if (event.key === 'Escape') dismiss()
      }} className={`w-full overflow-hidden border border-neutral-700 bg-[#121212] ${desktop ? 'min-h-dvh' : 'max-w-[444px] rounded-2xl'}`}>
        <header data-tauri-drag-region={desktop ? '' : undefined}
          className="flex select-none items-center justify-between border-b border-neutral-800 bg-neutral-900 px-3.5 py-2">
          <p className={`flex items-center gap-2 text-sm font-medium ${desktop ? 'pointer-events-none' : ''}`}>
            <span className="grid size-6 place-items-center rounded-lg bg-amber-400 text-neutral-950"><MessageCircle size={13} /></span>
            Реплика
          </p>
          <Button variant="ghost" className="size-8 min-h-8 px-0" aria-label="Закрыть регистрацию" onClick={dismiss}><X size={15} /></Button>
        </header>
        <div className="mx-auto max-w-[444px] px-5 pt-6 pb-5 min-[380px]:px-7">
          <h1 id="register-title" className="text-[26px] leading-tight font-bold">Регистрация</h1>
          <p id="register-help" className="mt-1.5 text-[13px] text-neutral-400">Демо-форма. Используйте вымышленные данные.</p>
          <form aria-describedby="register-help" className="mt-[18px] grid gap-3" onSubmit={(event) => {
            event.preventDefault()
            event.currentTarget.reset()
            setInvalid(false)
            setStatus('Данные формы прошли проверку.')
          }} onInput={() => setStatus('')}>
            <label className="grid gap-1.5 text-[13px] leading-4 font-medium">
              Имя
              <Input className="h-10 py-0!" name="name" placeholder="Например, Анна" autoComplete="off" maxLength={80} required />
            </label>
            <label className="grid gap-1.5 text-[13px] leading-4 font-medium">
              Электронная почта
              <Input className="h-10 py-0!" name="email" type="email" placeholder="name@example.com" autoComplete="off" maxLength={254} required />
            </label>
            <label className="grid gap-1.5 text-[13px] leading-4 font-medium">
              Пароль
              <Input className="h-10 py-0!" name="password" type="password" autoComplete="new-password" aria-describedby="register-password-help" minLength={8} maxLength={128} required />
              <span id="register-password-help" className="text-xs font-normal text-neutral-400">От 8 до 128 символов</span>
            </label>
            <Button type="submit" variant="primary" className="mt-1.5 min-h-[42px] w-full">Создать аккаунт</Button>
            {status && <p role="status" className={`text-[13px] ${invalid ? 'text-red-300' : 'text-green-300'}`}>{status}</p>}
          </form>
        </div>
      </section>
    </main>
  )
}
