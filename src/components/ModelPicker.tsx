import { useRef } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { models } from '../backend'
import type { ModelId } from '../backend'
import { Button } from './ui'

export function ModelLogo({ model }: { model: ModelId }) {
  return <img className="size-8 shrink-0" alt="" src={`./models/${model}.svg`} />
}

const descriptions = {
  gpt: 'Универсальные ответы',
  claude: 'Работа с длинным контекстом',
  gemini: 'Ответы по тексту и файлам',
  mistral: 'Ответы на вопросы',
}

interface Props {
  selected: ModelId
  connected: readonly ModelId[]
  onSelect: (model: ModelId) => void
}

export function ModelPicker({ selected, connected, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null)

  function scroll(direction: number) {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    track.current?.scrollBy({ left: direction * 272, behavior })
  }

  return (
    <section aria-labelledby="model-title" className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="model-title" className="text-[25px] font-bold">Модели для ответа</h2>
          <p className="mt-1 text-sm text-neutral-400">Листайте, чтобы выбрать модель. Доступность зависит от подключения по API.</p>
        </div>
        <div className="flex gap-2">
          <Button className="min-h-9 px-2.5" aria-label="Модели слева" onClick={() => scroll(-1)}><ArrowLeft size={16} /></Button>
          <Button className="min-h-9 px-2.5" aria-label="Модели справа" onClick={() => scroll(1)}><ArrowRight size={16} /></Button>
        </div>
      </div>
      <div ref={track} className="model-track flex snap-x gap-4 overflow-x-auto overscroll-x-none pt-1 pb-6">
        {models.map(({ id, name, provider }) => (
          <button key={id} onClick={() => onSelect(id)} aria-pressed={id === selected}
            className="group relative flex min-h-[143px] w-[257px] shrink-0 snap-start flex-col items-start rounded-[13px] border border-neutral-700 bg-neutral-900 px-4 py-3.5 text-left hover:border-neutral-500 data-[selected=true]:border-amber-400"
            data-selected={id === selected && connected.includes(id)}>
            <span className="model-emblem mb-2 grid size-8 place-items-center"><ModelLogo model={id} /></span>
            {id === selected && connected.includes(id) && <span aria-hidden="true" className="absolute top-4 right-3 grid size-4 place-items-center rounded-full bg-amber-400 text-neutral-950"><Check size={11} /></span>}
            <span className="text-lg font-semibold">{name}</span>
            <span className="text-xs text-neutral-400">{provider}</span>
            <span className="mt-2 text-[13px] text-neutral-300">{descriptions[id]}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
