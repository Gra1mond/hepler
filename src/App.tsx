import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Monitor } from 'lucide-react'
import { answerFormats, models } from './backend'
import type { AnswerFormat, AnswerRequest, DemoControls, ModelId, ReplicaBackend } from './backend'
import { Chat } from './components/Chat'
import type { Exchange } from './components/Chat'
import { CompanyPicker } from './components/CompanyPicker'
import { builtInCompanies, readCustomCompanies } from './companies'
import type { Company } from './companies'
import { Home } from './components/Home'
import { Interviews } from './components/Interviews'
import type { InterviewPage } from './components/Interviews'
import { normalizeQuestion, readInterviewLog } from './interviews'
import type { InterviewLog } from './interviews'
import { Materials, sampleQuestions, sampleResume } from './components/Materials'
import type { Resume, TrainingQuestion } from './components/Materials'
import { Profile, ProfileTabs, Usage } from './components/Overview'
import { Register } from './components/Register'
import { Settings } from './components/Settings'
import { pages, Sidebar } from './components/Sidebar'
import type { Page } from './components/Sidebar'
import { openMain, openWindow } from './windows'

type View = Page | 'compact' | 'register'

function isInterviewPage(hash: string): hash is InterviewPage {
  return /^profile\/interviews(?:\/questions|\/(?:company|question|dialogue)\/[a-z0-9-]+)?$/.test(hash)
}

function readView(): View {
  const hash = window.location.hash.slice(1)
  if (hash === 'compact' || hash === 'register' || hash === 'usage' || hash === 'usage/models') return hash
  if (hash === 'profile/materials' || isInterviewPage(hash)) return hash
  return pages.find((page) => page.id === hash)?.id ?? 'home'
}

interface Preferences {
  model: ModelId
  connected: ModelId[]
  format: AnswerFormat
  resume: Resume | null
  questions: TrainingQuestion[]
  customCompanies: Company[]
  interviews: InterviewLog[]
  interview?: { id: string; companyId: string | null }
}

const defaultPreferences: Preferences = {
  model: 'gpt', connected: [], format: 'Структурированный', resume: sampleResume, questions: sampleQuestions, customCompanies: [], interviews: [],
}
const preferencesKey = 'replica.demo.preferences'

function readPreferences(storage?: Storage): Preferences {
  try {
    const saved: Partial<Preferences> | null = JSON.parse(storage?.getItem(preferencesKey) ?? 'null')
    if (!saved) return defaultPreferences
    const interview = saved.interview
    return {
      model: models.find(({ id }) => id === saved.model)?.id ?? defaultPreferences.model,
      connected: models.filter(({ id }) => Array.isArray(saved.connected) && saved.connected.includes(id)).map(({ id }) => id),
      format: answerFormats.find((item) => item === saved.format) ?? defaultPreferences.format,
      resume: saved.resume === null || (typeof saved.resume?.name === 'string' && typeof saved.resume.text === 'string') ? saved.resume : sampleResume,
      questions: Array.isArray(saved.questions)
        ? saved.questions.filter((item) => typeof item?.text === 'string' && typeof item.topic === 'string')
        : sampleQuestions,
      customCompanies: readCustomCompanies(saved.customCompanies),
      interviews: readInterviewLog(saved.interviews),
      interview: typeof interview?.id === 'string'
        && (typeof interview.companyId === 'string' || interview.companyId === null) ? interview : undefined,
    }
  } catch {
    return defaultPreferences
  }
}

export function App({ backend, storage }: { backend: ReplicaBackend & Partial<DemoControls>; storage?: Storage }) {
  const [view, setView] = useState(readView)
  const [preferences, setPreferences] = useState(() => readPreferences(storage))
  const latestPreferences = useRef(preferences)
  const [draft, setDraft] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [includeResume, setIncludeResume] = useState(false)
  const [includeQuestions, setIncludeQuestions] = useState(false)
  const [windowError, setWindowError] = useState('')
  const [openConnection, setOpenConnection] = useState(false)
  const [showCompanies, setShowCompanies] = useState(false)
  const companyPickerTrigger = useRef<HTMLElement | null>(null)
  const active = useRef<{ controller: AbortController; id: number; question: string } | null>(null)
  const nextExchange = useRef(1)
  const { model, connected, format, resume, questions, customCompanies, interview, interviews } = preferences
  const companies = [...builtInCompanies, ...customCompanies]
  const company = companies.find(({ id }) => id === interview?.companyId)
  const canChat = connected.includes(model)

  useEffect(() => {
    const onRoute = () => setView(readView())
    window.addEventListener('hashchange', onRoute)
    return () => window.removeEventListener('hashchange', onRoute)
  }, [])

  useEffect(() => {
    if (!storage) return
    function syncPreferences(event: StorageEvent) {
      if (event.storageArea === storage && (event.key === preferencesKey || event.key === null)) {
        const next = readPreferences(storage)
        if (next.interview?.id !== latestPreferences.current.interview?.id) resetInterview()
        latestPreferences.current = next
        setPreferences(next)
      }
    }
    window.addEventListener('storage', syncPreferences)
    return () => window.removeEventListener('storage', syncPreferences)
  }, [storage])

  useEffect(() => () => active.current?.controller.abort(), [])

  function navigate(next: View, connect = false) {
    setWindowError('')
    setOpenConnection(connect)
    if (readView() !== next) window.location.hash = next
    setView(next)
  }

  function save(changes: Partial<Preferences>) {
    const next = { ...latestPreferences.current, ...changes }
    latestPreferences.current = next
    setPreferences(next)
    try {
      storage?.setItem(preferencesKey, JSON.stringify(next))
    } catch {
      // Keep the running demo usable when storage is unavailable.
    }
  }

  function connect(next: ModelId) {
    const current = latestPreferences.current.connected
    save({ model: next, connected: current.includes(next) ? current : [...current, next] })
  }

  function resetInterview() {
    active.current?.controller.abort()
    active.current = null
    setDraft('')
    setExchanges([])
  }

  function showCompanyPicker() {
    companyPickerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setShowCompanies(true)
  }

  function startInterview(selected: Company | null) {
    const current = latestPreferences.current
    const session = { id: crypto.randomUUID(), companyId: selected?.id ?? null }
    const isNew = selected && ![...builtInCompanies, ...current.customCompanies].some(({ id }) => id === selected.id)
    resetInterview()
    save({
      interview: session,
      customCompanies: isNew ? [...current.customCompanies, selected] : current.customCompanies,
      interviews: selected ? [...current.interviews, { id: session.id, companyId: selected.id, startedAt: new Date().toISOString(), questions: [] }] : current.interviews,
    })
    setShowCompanies(false)
    navigate('chat')
  }

  async function run(id: number, request: AnswerRequest) {
    if (active.current) return
    const controller = new AbortController()
    const session = latestPreferences.current.interview
    active.current = { controller, id, question: request.question }
    const pending: Exchange = { id, request, status: 'pending' }
    setExchanges((previous) => previous.some((item) => item.id === id)
      ? previous.map((item) => item.id === id ? pending : item)
      : [...previous, pending])

    try {
      const answer = await backend.answer(request, controller.signal)
      if (!controller.signal.aborted) {
        setExchanges((previous) => previous.map((item) => item.id === id ? { ...pending, status: 'complete', answer } : item))
        if (session?.companyId) {
          const current = latestPreferences.current
          const title = normalizeQuestion(request.question)
          const topic = current.questions.find((item) => normalizeQuestion(item.text) === title)?.topic ?? ''
          const at = new Date().toISOString()
          const entry = { id: crypto.randomUUID(), companyId: session.companyId, title: request.question, topic, at, answer }
          const target = current.interviews.find((item) => item.id === session.id)
          save({ interviews: target
            ? current.interviews.map((item) => item.id === session.id ? { ...item, questions: [...item.questions, entry] } : item)
            : [...current.interviews, { id: session.id, companyId: session.companyId, startedAt: at, questions: [entry] }],
          })
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        setExchanges((previous) => previous.map((item) => item.id === id ? { ...pending, status: 'error' } : item))
        setDraft((current) => current || request.question)
      }
    } finally {
      if (active.current?.controller === controller) active.current = null
    }
  }

  function stop() {
    const request = active.current
    if (!request) return
    active.current = null
    request.controller.abort()
    setExchanges((previous) => previous.filter((item) => item.id !== request.id))
    setDraft((current) => current || request.question)
  }

  function send() {
    const question = draft.trim()
    if (!canChat || !question || active.current) return
    setDraft('')
    const context = [
      includeResume ? resume?.text : '',
      includeQuestions ? questions.map(({ text, topic }) => topic ? `${topic} · ${text}` : text).join('\n') : '',
    ].filter(Boolean).join('\n\n')
    void run(nextExchange.current++, { model, question, format, materials: context.slice(0, 16000) || undefined })
  }

  async function open(operation: () => Promise<void>) {
    setWindowError('')
    try {
      await operation()
    } catch {
      setWindowError('Не удалось открыть окно. Попробуйте ещё раз.')
    }
  }

  const chat = <Chat model={model} connected={connected} exchanges={exchanges} draft={draft} format={format} company={company}
    compact={view === 'compact'} hasResume={!!resume?.text} includeResume={includeResume} questionCount={questions.length}
    includeQuestions={includeQuestions} onDraft={setDraft} onResume={setIncludeResume} onQuestions={setIncludeQuestions}
    onModel={(next) => save({ model: next })}
    onFormat={(next) => save({ format: next })} onSend={send} onStop={stop}
    onRetry={({ id, request }) => {
      if (draft.trim() === request.question) setDraft('')
      void run(id, request)
    }}
    onOpenMaterials={() => view === 'compact' ? void open(() => openMain('materials')) : navigate('materials')}
    onSettings={() => view === 'compact' ? void open(() => openMain('settings')) : navigate('settings', !canChat)}
    onChangeWindow={() => void open(() => view === 'compact' ? openMain('chat') : openWindow('compact'))} />

  if (view === 'register') return <Register />
  if (view === 'compact') {
    return (
      <main className="flex h-dvh flex-col overflow-hidden rounded-xl border border-neutral-700">
        {chat}
        {windowError && <p role="alert" className="absolute bottom-2 left-2 rounded-lg bg-neutral-900 p-2 text-xs text-red-300">{windowError}</p>}
      </main>
    )
  }

  const title = pages.find(({ id }) => id === view)?.title ?? 'Профиль'
  const isProfileView = view.startsWith('profile') || view.startsWith('usage')

  return (
    <div className="flex h-dvh flex-col bg-black sm:flex-row">
      <Sidebar page={view} navigate={(next) => {
        if (next === 'chat' && canChat && !interview) showCompanyPicker()
        else navigate(next)
      }} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {view === 'chat' ? chat : (
          <>
            <header className="flex min-h-16 shrink-0 items-center border-b border-neutral-800 px-4 text-sm font-medium sm:px-7">{title}</header>
            <div key={isProfileView ? view : undefined}
              className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none ${isProfileView ? '[scrollbar-gutter:stable]' : ''}`}>
              <div className={`mx-auto px-4 py-8 sm:px-7 ${view === 'home' ? 'lg:px-[47px] lg:pt-9' : 'max-w-[952px] lg:relative lg:-left-[5px]'} ${isProfileView ? 'lg:pt-[30px]' : view !== 'home' ? 'lg:pt-12' : ''}`}>
                {isProfileView && <><h1 className="mb-4 text-4xl font-bold">Профиль</h1><ProfileTabs current={view} /></>}
                {view === 'home' && <Home model={model} connected={connected} onSelect={(next) => save({ model: next })}
                  onStart={() => canChat ? showCompanyPicker() : navigate('settings', true)} onMaterials={() => navigate('materials')} />}
                {view === 'settings' && <Settings backend={backend} model={model} connected={connected} format={format}
                  onConnect={connect} onSaveFormat={(next) => save({ format: next })} onDemoFailure={backend.failNextAnswer}
                  initialFormOpen={openConnection} />}
                {(view === 'materials' || view === 'profile/materials') && <Materials inProfile={isProfileView} resume={resume} questions={questions}
                  onResume={(next) => save({ resume: next })} onQuestions={(next) => save({ questions: next })} />}
                {view === 'profile' && <Profile onRegister={() => void open(() => openWindow('register'))} />}
                {isInterviewPage(view) && <Interviews page={view} companies={companies} interviews={interviews} />}
                {(view === 'usage' || view === 'usage/models') && <Usage details={view === 'usage/models'} />}
                {view === 'records' && <Records />}
              </div>
            </div>
          </>
        )}
      </main>
      {showCompanies && <CompanyPicker companies={companies} onStart={startInterview} onClose={() => {
        setShowCompanies(false)
        requestAnimationFrame(() => companyPickerTrigger.current?.focus())
      }} />}
      {windowError && <p role="alert" className="fixed bottom-4 left-4 z-20 rounded-lg border border-red-400/40 bg-neutral-950 px-4 py-3 text-sm text-red-300">{windowError}</p>}
    </div>
  )
}

function Records() {
  return (
    <section>
      <h1 className="text-4xl font-bold">Записи</h1>
      <p className="mt-3 text-[15px] text-neutral-400">Раздел для разбора собеседований после звонка.</p>
      <div className="mt-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-10 text-center sm:mt-16 sm:px-14 sm:py-16">
        <span className="mx-auto mb-6 grid size-12 place-items-center rounded-xl bg-amber-400/8 text-amber-400"><Monitor size={20} /></span>
        <h2 className="text-2xl font-bold">Записи появятся здесь</h2>
        <p className="mt-4 text-sm text-neutral-400">В будущей версии здесь можно будет открыть запись экрана и диалога.</p>
        <div className="mt-12 grid gap-7 text-left sm:grid-cols-2">
          <div className="border-t border-neutral-700 pt-5"><h3 className="flex items-center gap-2 text-sm font-medium"><Monitor size={15} />Запись экрана</h3><p className="mt-2 text-[13px] text-neutral-400">Пересмотреть действия во время собеседования.</p></div>
          <div className="border-t border-neutral-700 pt-5"><h3 className="flex items-center gap-2 text-sm font-medium"><MessageCircle size={15} />Запись диалога</h3><p className="mt-2 text-[13px] text-neutral-400">Вернуться к вопросам интервьюера и своим ответам.</p></div>
        </div>
      </div>
    </section>
  )
}
