import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, ChartNoAxesColumn, Copy, FileText, List, MessageCircle, Monitor, Plus, Terminal, Zap } from 'lucide-react'
import { answerFormats, models } from '../backend'
import type { Answer, AnswerFormat, AnswerRequest, ModelId } from '../backend'
import type { Company } from '../companies'
import { CompanyLogo } from './CompanyPicker'
import { Button } from './ui'

export type Exchange = {
  id: number
  request: AnswerRequest
} & ({ status: 'pending' | 'error' } | { status: 'complete'; answer: Answer })

interface Props {
  model: ModelId
  connected: readonly ModelId[]
  exchanges: readonly Exchange[]
  draft: string
  format: AnswerFormat
  company?: Company
  includeResume: boolean
  hasResume: boolean
  includeQuestions: boolean
  questionCount: number
  onDraft: (draft: string) => void
  onResume: (include: boolean) => void
  onQuestions: (include: boolean) => void
  onModel: (model: ModelId) => void
  onFormat: (format: AnswerFormat) => void
  onSend: () => void
  onStop: () => void
  onRetry: (exchange: Exchange) => void
  onOpenMaterials: () => void
  onSettings: () => void
  onChangeWindow: () => void
  compact?: boolean
}

const smallButton = 'min-h-8 rounded-md px-2.5 text-[13px]'
const pickerClass = 'max-w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-[13px] text-neutral-300'
const requestPlural = new Intl.PluralRules('ru-RU')
const requestLabels = { one: 'запрос', few: 'запроса', many: 'запросов', other: 'запросов', zero: 'запросов', two: 'запроса' } as const

export function Chat(props: Props) {
  const { model, connected, exchanges, draft, format, includeResume, hasResume, includeQuestions, questionCount, compact } = props
  const pending = exchanges.some((exchange) => exchange.status === 'pending')
  const completed = exchanges.filter((exchange) => exchange.status === 'complete').length
  const canSend = connected.includes(model)
  const scroll = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [exchanges])

  function submit(event: FormEvent) {
    event.preventDefault()
    props.onSend()
  }

  return (
    <section aria-labelledby="chat-title" className="flex h-full min-h-0 flex-col">
      <header className={`flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-4 py-2 ${compact ? 'bg-[#121212]' : 'sm:px-7'}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <h1 id="chat-title" className="flex items-center gap-2 text-sm font-medium">
            {compact && <BrandMark />}{compact ? <><span>Реплика</span><span className="sr-only">Компактный чат</span></> : 'Собеседование'}
          </h1>
          {props.company && <span className="company-logo-target inline-flex min-w-0 max-w-48 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/8 px-2 py-1.5 text-xs font-medium text-amber-300">
            <CompanyLogo company={props.company} className="size-5 rounded-md text-[9px]" />
            <span className="truncate" title={props.company.name}>{props.company.name}</span>
          </span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-[#121212] px-2.5 py-2 text-xs">
            <ChartNoAxesColumn size={13} className="text-neutral-400" />{completed} {requestLabels[requestPlural.select(completed)]} · 0,00 $
          </span>
          {!compact && <select aria-label="Модель для ответа" className={pickerClass} value={model}
            onChange={(event) => props.onModel(event.currentTarget.value as ModelId)}>
            {models.map(({ id, name, provider }) => <option key={id} value={id} disabled={id !== model && !connected.includes(id)}>{name} · {provider}</option>)}
          </select>}
          <Button className={smallButton} aria-label={compact ? 'Открыть основной чат' : 'Компактное окно'} onClick={props.onChangeWindow}>
            <ArrowUpRight size={14} className="text-amber-400" />{!compact && 'Компактное окно'}
          </Button>
        </div>
      </header>
      <div className={`mx-auto flex min-h-0 w-full max-w-[918px] flex-1 flex-col px-4 ${compact ? 'pb-5 pt-2 sm:px-[19px]' : 'pb-4 sm:px-7'}`}>
        <div ref={scroll} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none">
          {!exchanges.length && (
            <div className="grid min-h-full place-content-center justify-items-center gap-5 px-2 pt-8 pb-6 text-center">
              <BrandMark large />
              <h2 className={`font-bold ${compact ? 'text-xl' : 'text-2xl sm:text-4xl'}`}>Введите вопрос интервьюера</h2>
              <p className="text-sm leading-6 text-neutral-400 sm:text-base">
                {canSend ? 'Реплика соберёт ответ из тезиса, объяснения и примера.' : 'Подключите модель, чтобы начать чат.'}
              </p>
              {!canSend && <Button onClick={props.onSettings}>Подключить модель</Button>}
              {!compact && canSend && <InterviewLabel />}
            </div>
          )}
          {exchanges.length > 0 && !compact && <div className="mt-10 mb-6"><InterviewLabel /></div>}
          <ol className="grid min-w-0 gap-8 pb-4">
            {exchanges.map((exchange) => (
              <li key={exchange.id} className="grid min-w-0 gap-5 sm:gap-7">
                <div className={`min-w-0 ${compact ? 'pt-3' : 'ml-auto min-h-[78px] w-full max-w-[30rem] rounded-2xl bg-neutral-800 px-4 py-3 sm:mr-8'}`}>
                  <p className="mb-1 text-[13px] text-neutral-400">Вопрос интервьюера</p>
                  <p className="whitespace-pre-wrap font-semibold [overflow-wrap:anywhere]">{exchange.request.question}</p>
                </div>
                <div className={compact ? '' : 'sm:pl-8'}>
                  {!compact && <p className="mb-3 flex items-center gap-3.5 text-sm font-semibold"><BrandMark />Реплика</p>}
                  <div className={compact ? '' : 'sm:ml-[45px]'}>
                    {exchange.status === 'pending' && (
                      <div className="flex items-start gap-3 py-2">
                        <span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded-full border-2 border-dotted border-neutral-300 motion-safe:animate-spin" />
                        <div>
                          <div role="status"><h2 className="text-xl font-semibold">Агент готовит ответ...</h2>
                            <p className="mt-1 text-[13px] text-neutral-400">Тезис, объяснение и пример появятся здесь.</p></div>
                          <Button className={`${smallButton} mt-4`} onClick={props.onStop}>Остановить</Button>
                        </div>
                      </div>
                    )}
                    {exchange.status === 'error' && <div className="space-y-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm sm:mr-8">
                      <p role="alert" className="text-lg font-semibold text-amber-400">Не удалось получить ответ.</p>
                      <p className="text-[13px] text-neutral-300">Повторите запрос. Если ошибка сохранится, проверьте подключение агента.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" className={smallButton} disabled={pending} onClick={() => props.onRetry(exchange)}>Повторить</Button>
                        <Button className={smallButton} onClick={props.onSettings}>Настройки агента</Button>
                      </div>
                    </div>}
                    {exchange.status === 'complete' && <AnswerCard answer={exchange.answer} compact={compact} />}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative isolate mt-3 w-full shrink-0">
          <div aria-hidden="true" className="composer-glow pointer-events-none absolute inset-0 -z-10 rounded-[18px]" />
          <form ref={form} onSubmit={submit} className="rounded-[18px] border border-neutral-700 bg-[#0b0b0b] px-2.5 py-3">
            <div className={`flex items-start gap-2 px-2 ${compact ? 'pb-3' : 'mb-3 border-b border-neutral-800 pb-3'}`}>
              <Terminal size={14} className="mt-1.5 shrink-0 text-neutral-400" />
              <textarea rows={1} value={draft} placeholder="Введите вопрос интервьюера" aria-label="Вопрос"
                className="field-sizing-content max-h-27 min-h-7 w-full resize-none rounded-sm bg-transparent px-1 text-sm leading-7 placeholder:text-neutral-400 focus-visible:outline-offset-0 sm:text-base"
                onChange={(event) => props.onDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    form.current?.requestSubmit()
                  }
                }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className={smallButton} aria-label="Открыть материалы" onClick={props.onOpenMaterials}><Plus size={15} /></Button>
              <Button className={`${smallButton} aria-pressed:border-amber-400/50 aria-pressed:text-amber-300`}
                aria-pressed={includeResume && hasResume} disabled={!hasResume}
                onClick={() => props.onResume(!includeResume)}><FileText size={13} />Резюме</Button>
              {!compact && <Button className={`${smallButton} aria-pressed:border-amber-400/50 aria-pressed:text-amber-300`}
                aria-pressed={includeQuestions && questionCount > 0} disabled={questionCount === 0}
                onClick={() => props.onQuestions(!includeQuestions)}><List size={13} />Вопросы · {questionCount}</Button>}
              {!compact && <select aria-label="Формат ответа" className={pickerClass} value={format}
                onChange={(event) => props.onFormat(event.currentTarget.value as AnswerFormat)}>
                {answerFormats.map((item) => <option key={item}>{item}</option>)}
              </select>}
              <Button className={`${smallButton} ml-auto min-h-7 px-2`} type="submit" disabled={!canSend || pending || !draft.trim()} aria-label="Отправить">
                <kbd>Enter ↵</kbd>
              </Button>
            </div>
          </form>
        </div>
        {!compact && <p className="flex items-start gap-2 px-2 pt-4 text-[13px] text-neutral-400"><Monitor size={14} className="mt-0.5 shrink-0" />При демонстрации выберите рабочее окно в сервисе звонка.</p>}
      </div>
    </section>
  )
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg bg-amber-400 text-neutral-950 ${large ? 'size-11' : 'size-8'}`}>
      <MessageCircle size={16} />
    </span>
  )
}

function InterviewLabel() {
  return <span className="inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-2.5 py-2 text-xs font-semibold text-amber-400"><Zap size={14} />Техническое интервью</span>
}

function AnswerCard({ answer, compact }: { answer: Answer; compact?: boolean }) {
  const [copyStatus, setCopyStatus] = useState('')

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText([answer.summary, answer.explanation, answer.example].filter(Boolean).join('\n\n'))
      setCopyStatus('Скопировано')
    } catch {
      setCopyStatus('Не удалось скопировать')
    }
  }

  return (
    <article aria-label="Ответ модели" className={`grid gap-4 ${compact ? '' : 'rounded-2xl border border-neutral-800 bg-[#121212] p-3.5'}`}>
      <div className="relative space-y-2 rounded-xl bg-amber-400/10 px-4 py-3">
        <span aria-hidden="true" className="absolute inset-y-4 left-0 w-0.5 bg-amber-400" />
        <h2 className="text-xs font-semibold text-amber-400">Тезис</h2>
        <p className={`font-bold whitespace-pre-line [overflow-wrap:anywhere] ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>{answer.summary}</p>
      </div>
      {answer.explanation && <div className="space-y-1 px-1"><h2 className="text-sm font-medium">Объяснение</h2><p className="leading-6 text-neutral-200">{answer.explanation}</p></div>}
      {answer.example && <div className={`space-y-1 px-1 ${compact ? '' : 'border-t border-neutral-800 pt-3'}`}><h2 className="text-sm font-medium">Пример</h2><p className="leading-6 text-neutral-200">{answer.example}</p></div>}
      <div className="flex flex-wrap items-center gap-2">
        <Button className={smallButton} onClick={() => void copyAnswer()}><Copy size={13} />Копировать</Button>
        {copyStatus && <span role="status" className="text-xs text-neutral-400">{copyStatus}</span>}
      </div>
    </article>
  )
}
