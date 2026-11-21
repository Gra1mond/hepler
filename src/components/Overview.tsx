import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, Check, MessageCircle, UserPlus } from 'lucide-react'
import { models } from '../backend'
import type { ModelId } from '../backend'
import { ModelLogo } from './ModelPicker'
import { Button } from './ui'

const profileTabs = [
  ['profile', 'Данные аккаунта'],
  ['profile/interviews', 'Собеседования'],
  ['profile/materials', 'Материалы'],
  ['usage', 'Использование API'],
] as const

export function ProfileTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Разделы профиля" className="mb-7 flex flex-wrap gap-x-5 border-b border-neutral-800 text-sm">
      {profileTabs.map(([id, title]) => {
        const selected = current === id || (id !== 'profile' && current.startsWith(id + '/'))
        return <a key={id} href={`#${id}`} aria-current={selected ? 'page' : undefined}
          className="border-b-2 border-transparent px-2.5 py-2.5 text-neutral-400 hover:text-neutral-100 aria-[current=page]:border-amber-400 aria-[current=page]:font-medium aria-[current=page]:text-neutral-100">{title}</a>
      })}
    </nav>
  )
}

export function Profile({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Личные данные</h2>
      <div className="flex items-center gap-5 rounded-2xl border border-neutral-800 bg-[#121212] p-5 sm:gap-7 sm:p-6">
        <span aria-hidden="true" className="grid size-18 shrink-0 place-items-center rounded-full bg-amber-400 text-2xl font-semibold text-neutral-950 sm:size-[100px] sm:text-4xl">АП</span>
        <div className="min-w-0">
          <p className="text-xl font-semibold">Анна Петрова</p>
          <p className="mt-2 text-sm text-neutral-400 [overflow-wrap:anywhere]">anna@example.com</p>
        </div>
      </div>
      <Button variant="ghost" onClick={onRegister}><UserPlus size={15} />Создать аккаунт</Button>
    </section>
  )
}

const formatNumber = new Intl.NumberFormat('ru-RU')
const sum = (values: readonly number[]) => values.reduce((total, amount) => total + amount, 0)

const chatUsage: Record<ModelId, readonly { title: string; count: number; cents: number }[]> = {
  gpt: [
    { title: 'Подготовка к собеседованию', count: 24, cents: 18 },
    { title: 'Разбор вопросов', count: 18, cents: 13 },
    { title: 'Практика ответов', count: 12, cents: 9 },
  ],
  claude: [
    { title: 'Архитектура приложения', count: 16, cents: 12 },
    { title: 'Разбор резюме', count: 12, cents: 9 },
    { title: 'Системный дизайн', count: 10, cents: 7 },
  ],
  gemini: [
    { title: 'Подготовка материалов', count: 10, cents: 4 },
    { title: 'Разбор вопросов', count: 8, cents: 4 },
    { title: 'Практика ответов', count: 6, cents: 2 },
  ],
  mistral: [
    { title: 'Технические вопросы', count: 5, cents: 3 },
    { title: 'Разбор резюме', count: 4, cents: 2 },
    { title: 'Практика ответов', count: 3, cents: 1 },
  ],
}

const modelUsage = models.map((model) => ({
  ...model,
  count: sum(chatUsage[model.id].map(({ count }) => count)),
  cents: sum(chatUsage[model.id].map(({ cents }) => cents)),
}))
const dailyCosts = [0.08, 0.16, 0.10, 0.06, 0.12, 0.19, 0.13]
const usagePeriod = '13–19 ноября'
const demoPeriod = usagePeriod + ' · Демонстрационные данные'
const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' })
const plural = new Intl.PluralRules('ru-RU')
const requests = (count: number) =>
  `${formatNumber.format(count)} ${plural.select(count) === 'one' ? 'запрос' : plural.select(count) === 'few' ? 'запроса' : 'запросов'}`

export function Usage({ details }: { details: boolean }) {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">История использования</h2>
        <p className="mt-3 text-[15px] text-neutral-400">
          {details ? 'Выберите модель, чтобы посмотреть расходы по чатам.' : 'Запросы и расходы на ответы моделей.'}
        </p>
      </header>
      {details ? <UsageDetails /> : <UsageOverview />}
    </section>
  )
}

function UsageOverview() {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-1/4 -top-12 -z-10 h-20 rounded-full bg-amber-400/12 blur-2xl" />
      <div className="flex items-start gap-3 border-b border-neutral-800 pb-4">
        <span className="grid size-10 place-items-center rounded-xl bg-amber-400/10 text-amber-400"><ChartNoAxesColumnIncreasing size={18} /></span>
        <div><h2 className="text-xl font-semibold">Использование API</h2><p className="mt-1 text-[13px] text-neutral-400">{demoPeriod}</p></div>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-neutral-400">Запросы</dt>
          <dd className="my-1 text-4xl font-semibold">{sum(modelUsage.map(({ count }) => count))}</dd>
          <dd className="text-xs text-neutral-400">За {usagePeriod}</dd>
        </div>
        <div className="sm:border-l sm:border-neutral-800 sm:pl-6">
          <dt className="text-[13px] text-neutral-400">Расходы по API</dt>
          <dd className="my-1 text-4xl font-semibold">{currency.format(sum(modelUsage.map(({ cents }) => cents)) / 100)}</dd>
          <dd className="text-xs text-neutral-400">Оценка за {usagePeriod}</dd>
        </div>
      </dl>
      <figure className="mt-6">
        <figcaption className="mb-2 text-sm font-semibold">Расходы по дням, $</figcaption>
        <AreaChart values={dailyCosts} label="График расходов с 13 по 19 ноября" labels={['0,20', '0,10', '0,00']} maximum={0.20} />
        <div className="mt-2 flex justify-between pl-9 text-xs text-neutral-400">{dailyCosts.map((_, index) => <span key={index} className="text-center">{index + 13} ноя</span>)}</div>
      </figure>
      <div className="mt-7 border-t border-neutral-800 pt-5">
        <a href="#usage/models" className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-400/35 px-3 text-center text-sm font-medium text-amber-400 hover:bg-amber-400/10">
          Детализация по моделям <ArrowRight size={15} />
        </a>
      </div>
    </div>
  )
}

function UsageDetails() {
  const [selection, setSelection] = useState<ModelId>('claude')
  const activeModel = modelUsage.find(({ id }) => id === selection) ?? modelUsage[0]

  return (
    <div className="space-y-6">
      <a href="#usage" className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-white"><ArrowLeft size={15} />К обзору</a>
      <section aria-labelledby="usage-models">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="usage-models" className="text-lg font-semibold">Модели</h2>
          <p className="text-[13px] text-neutral-400">{demoPeriod}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {modelUsage.map(({ id, name, count, cents }) => (
            <button key={id} type="button" aria-pressed={id === selection} onClick={() => setSelection(id)}
              className="group relative grid min-w-0 gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/65 p-2.5 text-left hover:border-neutral-600 aria-pressed:border-amber-400/35 aria-pressed:bg-amber-400/8">
              <div className="relative grid h-28 place-items-center rounded-xl border border-neutral-800 bg-neutral-900/70 group-aria-pressed:border-amber-400/15 group-aria-pressed:bg-amber-400/3">
                <span aria-hidden="true" className="pointer-events-none absolute size-16 rounded-full bg-neutral-500/20 blur-xl group-aria-pressed:bg-amber-400/20" />
                <span aria-hidden="true" className="relative grid size-14 place-items-center">
                  <span className="model-layer model-layer-left group-aria-pressed:border-amber-400/20 group-aria-pressed:bg-amber-400/10" />
                  <span className="model-layer model-layer-right group-aria-pressed:border-amber-400/20 group-aria-pressed:bg-amber-400/10" />
                  <span className="model-emblem relative grid size-full place-items-center rounded-2xl border border-neutral-700 bg-neutral-800 shadow-lg group-aria-pressed:border-amber-400/25 group-aria-pressed:bg-neutral-900">
                    <ModelLogo model={id} />
                  </span>
                </span>
                {id === selection && <Check aria-hidden="true" size={20} className="absolute top-2 right-2 rounded-full border border-amber-400/30 bg-amber-400/10 p-1 text-amber-400" />}
              </div>
              <span className="px-1 text-lg font-semibold">{name}</span>
              <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t border-neutral-800 px-1 pt-2">
                <span className="text-[13px] text-neutral-400">{requests(count)}</span>
                <span className="text-sm font-semibold group-aria-pressed:text-amber-400">{currency.format(cents / 100)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="usage-chats">
        <h2 id="usage-chats" className="text-2xl font-semibold">Расходы по чатам</h2>
        <p aria-live="polite" className="mt-1 text-sm text-neutral-400">{activeModel.name} · {requests(activeModel.count)} · {currency.format(activeModel.cents / 100)}</p>
        <ul className="mt-4 grid gap-4 lg:grid-cols-3">
          {chatUsage[selection].map(({ title, count, cents }) => (
            <li key={title} className="rounded-xl border border-neutral-800 bg-neutral-900/65 p-3.5">
              <h3 className="flex min-h-8 items-center gap-2.5 text-sm font-medium">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400"><MessageCircle size={13} /></span>
                {title}
              </h3>
              <dl className="mt-3 flex justify-between gap-3 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
                <div><dt>Запросы</dt><dd className="mt-1 text-lg font-semibold text-neutral-100">{count}</dd></div>
                <div className="text-right"><dt>Расходы</dt><dd className="mt-1 text-lg font-semibold text-neutral-100">{currency.format(cents / 100)}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function AreaChart({ values, label, labels, maximum }: { values: readonly number[]; label: string; labels?: readonly string[]; maximum?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const context = element.getContext('2d')
    if (!context) return

    function draw() {
      if (!element || !context) return
      const { width, height } = element.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      element.width = Math.round(width * scale)
      element.height = Math.round(height * scale)
      context.scale(scale, scale)
      const bottom = height - 9
      const top = 9
      const scaleHigh = maximum ?? (Math.max(...values) * 1.06 || 1)
      const styles = getComputedStyle(element)
      context.strokeStyle = styles.getPropertyValue('--color-neutral-700').trim() || '#404040'
      for (const y of [top, (top + bottom) / 2, bottom]) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }

      const edge = maximum ? 8 : 0
      const points = values.map((value, index) => [edge + index * (width - 2 * edge) / (values.length - 1), bottom - value / scaleHigh * (bottom - top)])
      function plot() {
        if (!context) return
        context.beginPath()
        context.moveTo(points[0][0], points[0][1])
        points.slice(1).forEach(([x, y], index) => {
          const [lastX, lastY] = points[index]
          const midpoint = (lastX + x) / 2
          context.bezierCurveTo(midpoint, lastY, midpoint, y, x, y)
        })
      }

      plot()
      context.lineTo(points[points.length - 1][0], bottom)
      context.lineTo(points[0][0], bottom)
      context.closePath()
      const fill = context.createLinearGradient(0, top, 0, bottom)
      fill.addColorStop(0, 'rgba(251, 191, 36, .22)')
      fill.addColorStop(1, 'rgba(251, 191, 36, 0)')
      context.fillStyle = fill
      context.fill()
      plot()
      context.strokeStyle = styles.getPropertyValue('--color-amber-400').trim() || '#fbbf24'
      context.lineWidth = 2
      context.stroke()
      if (maximum) {
        const [x, y] = points[points.length - 1]
        context.fillStyle = context.strokeStyle
        context.beginPath()
        context.arc(x, y, 3.5, 0, 2 * Math.PI)
        context.fill()
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(element)
    return () => observer.disconnect()
  }, [values, maximum])

  return (
    <div className="flex gap-2">
      {labels && <div aria-hidden="true" className="flex w-8 flex-col justify-between py-0.5 text-xs text-neutral-400">{labels.map((text) => <span key={text}>{text}</span>)}</div>}
      <canvas ref={canvas} role="img" aria-label={label} className="block h-32 w-0 flex-1" />
    </div>
  )
}
