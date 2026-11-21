import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plug, Plus, X } from 'lucide-react'
import { answerFormats, demoCode, models, unavailableDemoCode } from '../backend'
import type { AnswerFormat, ModelId, ReplicaBackend } from '../backend'
import { ModelLogo } from './ModelPicker'
import { Button, fieldClass, Input, Modal } from './ui'

interface ConnectionProps {
  backend: ReplicaBackend
  model: ModelId
  onConnect: (model: ModelId) => void
  onClose: () => void
}

function ConnectionDialog({ backend, model, onConnect, onClose }: ConnectionProps) {
  const [provider, setProvider] = useState(model)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'editing' | 'pending' | 'valid' | 'invalid' | 'unavailable'>('editing')
  const busy = useRef(false)
  const pending = status === 'pending'

  async function validate(save: boolean) {
    if (busy.current || !code.trim()) return
    busy.current = true
    try {
      if (status !== 'valid') {
        setStatus('pending')
        await backend.connect(provider, code)
      }
      if (save) onConnect(provider)
      else setStatus('valid')
    } catch (reason) {
      setStatus(reason instanceof Error && reason.message === 'model-unavailable' ? 'unavailable' : 'invalid')
    } finally {
      busy.current = false
    }
  }

  function changeCode(value: string) {
    setCode(value)
    setStatus('editing')
  }

  return (
    <Modal titleId="connect-title" className="border-amber-400/45 sm:p-7" onClose={() => { if (!pending) onClose() }}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="connect-title" className="text-2xl font-semibold">Добавить API-подключение</h2>
        <Button className="min-h-8 px-2.5" aria-label="Закрыть" disabled={pending} onClick={onClose}><X size={15} /></Button>
      </div>
      <p className="mt-2 mb-6 text-[13px] text-neutral-400">Выберите провайдера и модель, затем введите демо-ключ.</p>
      <form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void validate(true) }}>
        <label className="block space-y-1.5 text-sm"><span>Провайдер</span>
          <select className={fieldClass} value={provider} disabled={pending}
            onChange={(event) => { setProvider(event.currentTarget.value as ModelId); setStatus('editing') }}>
            {models.map(({ id, provider: company }) => <option key={id} value={id}>{company}</option>)}
          </select>
        </label>
        <div className="space-y-1.5 text-sm">
          <label htmlFor="connection-model">Модель</label>
          <Input id="connection-model" readOnly value={models.find(({ id }) => id === provider)?.name ?? ''} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm" htmlFor="demo-key">Ключ API</label>
          <Input id="demo-key" placeholder="Введите демо-ключ" type="password" autoComplete="off"
            value={code} disabled={pending} aria-invalid={status === 'invalid'}
            aria-describedby={status === 'invalid' || status === 'unavailable' ? 'connection-status' : undefined}
            onChange={(event) => changeCode(event.currentTarget.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="px-2.5 text-[13px]" disabled={pending || !code.trim()} onClick={() => void validate(false)}>
            {pending ? 'Проверка…' : 'Проверить подключение'}
          </Button>
          <Button variant="ghost" className="min-h-8 px-1.5 text-xs" disabled={pending} onClick={() => changeCode(demoCode)}>Демо-ключ</Button>
          <Button variant="ghost" className="min-h-8 px-1.5 text-xs" disabled={pending} onClick={() => changeCode(unavailableDemoCode)}>Недоступная модель</Button>
        </div>
        {status === 'valid' && <p role="status" className="text-sm text-emerald-300">Подключение проверено.</p>}
        {status === 'invalid' && <p id="connection-status" role="alert" className="text-sm text-red-300">Демо-ключ не подошёл. Вставьте демо-ключ и попробуйте ещё раз.</p>}
        {status === 'unavailable' && <p id="connection-status" role="alert" className="text-sm text-amber-300">Модель недоступна для этого ключа.</p>}
        <div className="flex justify-end gap-3 border-t border-neutral-700 pt-4">
          <Button disabled={pending} onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" disabled={pending || !code.trim() || status === 'unavailable' || status === 'invalid'}>Добавить</Button>
        </div>
      </form>
    </Modal>
  )
}

interface Props {
  backend: ReplicaBackend
  model: ModelId
  connected: readonly ModelId[]
  format: AnswerFormat
  onConnect: (model: ModelId) => void
  onSaveFormat: (format: AnswerFormat) => void
  onDemoFailure?: () => void
  initialFormOpen: boolean
}

const formatNotes: Record<AnswerFormat, string> = {
  Краткий: 'Только тезис',
  Структурированный: 'Тезис, объяснение и пример',
  Развёрнутый: 'Подробности и оговорки',
}

export function Settings({ backend, model, connected, format, onConnect, onSaveFormat, onDemoFailure, initialFormOpen }: Props) {
  const [formOpen, setFormOpen] = useState(initialFormOpen)
  const [draftFormat, setDraftFormat] = useState(format)
  const [notice, setNotice] = useState('')

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold">Настройки агента</h1>
        <p className="mt-3 text-[15px] text-neutral-400">Подключение по API и формат ответа для собеседования.</p>
      </header>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-2">
          <h2 className="text-[22px] font-semibold">Подключение по API</h2>
          <Button variant="primary" onClick={() => { setNotice(''); setFormOpen(true) }}><Plus size={15} />Добавить</Button>
        </div>
        {!connected.length && <ConnectionCard title="Нет API-подключений" description="Добавьте провайдера, чтобы агент мог отвечать в чате." />}
        {models.filter(({ id }) => connected.includes(id)).map(({ id, name, provider }) => (
          <ConnectionCard key={id} model={id} title={provider} description={`${name} · Демо-подключение`} status={`${name} подключена`} />
        ))}
      </section>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        onSaveFormat(draftFormat)
        setNotice('Формат ответа сохранён')
      }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-2">
          <h2 id="format-heading" className="text-[22px] font-semibold">Формат ответа</h2>
          <Button type="submit" className="min-w-30">Сохранить</Button>
        </div>
        <div role="radiogroup" aria-labelledby="format-heading" className="grid gap-3 md:grid-cols-3">
          {answerFormats.map((item, index) => (
            <label key={item} className="grid cursor-pointer gap-3 rounded-2xl border border-neutral-700 bg-[#121212] p-3 has-checked:border-amber-400/40 has-checked:bg-amber-400/8">
              <span aria-hidden="true" className="grid h-27 place-items-center rounded-xl border border-neutral-800 bg-neutral-900">
                <span className={`grid w-24 gap-1.5 rounded-xl border bg-neutral-800 px-4 py-4 shadow-md ${draftFormat === item ? 'border-amber-400/45 text-amber-300' : 'border-neutral-600 text-neutral-400'} ${index === 2 ? '-rotate-6' : ''}`}>
                  {Array.from({ length: index === 0 ? 1 : index + 2 }, (_, line) => (
                    <span key={line} className={`h-[3px] rounded-full bg-current ${line % 2 ? 'w-2/3 opacity-60' : 'w-full'}`} />
                  ))}
                </span>
              </span>
              <span className="flex items-center gap-2 border-t border-neutral-800 pt-2.5 font-medium">
                <input type="radio" name="answer-format" className="accent-amber-400" checked={draftFormat === item}
                  onChange={() => { setDraftFormat(item); setNotice('') }} />{item}
              </span>
              <span className="-mt-1 text-[13px] text-neutral-400">{formatNotes[item]}</span>
            </label>
          ))}
        </div>
      </form>
      {onDemoFailure && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => { onDemoFailure(); setNotice('Следующий запрос в основном чате завершится ошибкой.') }}>Сбой следующего ответа</Button>
        </div>
      )}
      {notice && <p role="status" className="fixed bottom-6 left-6 z-10 max-w-[calc(100%-3rem)] rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm">{notice}</p>}
      {formOpen && <ConnectionDialog backend={backend} model={model} onConnect={(next) => {
        onConnect(next)
        setFormOpen(false)
        setNotice('Подключение добавлено')
      }} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function ConnectionCard({ model, title, description, status }: { model?: ModelId; title: string; description: string; status?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-800 bg-[#121212] p-2.5 sm:gap-5">
      <span className="grid h-[90px] w-27 shrink-0 place-items-center rounded-xl border border-amber-400/10 bg-amber-400/5 sm:w-[146px]">
        <span className="group relative grid size-12 place-items-center">
          <span className="model-layer model-layer-left border-amber-400/20 bg-amber-400/8" />
          <span className="model-layer model-layer-right border-amber-400/20 bg-amber-400/8" />
          <span className="model-emblem z-10 grid size-full place-items-center rounded-lg border border-amber-400/15 bg-neutral-900 text-amber-400 shadow-[0_0_22px_rgb(251_191_36/0.18)]">{model ? <ModelLogo model={model} /> : <Plug size={18} />}</span>
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-400">{description}</p>
      </div>
      {status && <p className="flex items-center gap-1.5 rounded-lg border border-emerald-700/50 bg-emerald-400/8 px-3 py-2 text-xs text-emerald-300 sm:mr-2"><Check size={13} />{status}</p>}
    </div>
  )
}
