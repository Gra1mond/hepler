import { ArrowRight, FileText, MessageCircle, Zap } from 'lucide-react'
import type { ModelId } from '../backend'
import { ModelPicker } from './ModelPicker'
import { Button } from './ui'

interface Props {
  model: ModelId
  connected: readonly ModelId[]
  onSelect: (model: ModelId) => void
  onStart: () => void
  onMaterials: () => void
}

export function Home({ model, connected, onSelect, onStart, onMaterials }: Props) {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 lg:gap-10">
      <section className="relative isolate flex min-h-80 items-center overflow-hidden rounded-[19px] border border-neutral-700 bg-neutral-950 px-5 py-8 sm:px-8 lg:min-h-[366px]">
        <div className="z-10 max-w-[27rem]">
          <p className="mb-5 text-[13px] font-semibold text-amber-400">Реплика для собеседований</p>
          <h1 className="text-[clamp(2rem,3.6vw,2.8125rem)] leading-[1.16] font-bold">Услышьте вопрос.<br />Соберите ответ.</h1>
          <p className="mt-4 max-w-[25rem] text-[15px] leading-6 text-neutral-400">
            {connected.includes(model)
              ? 'Выберите модель, добавьте материалы и начните диалог в отдельном окне.'
              : 'Добавьте API-подключение, чтобы выбрать модель и начать собеседование.'}
          </p>
          <Button variant="primary" className="mt-8 min-w-[228px] px-5" onClick={onStart}>
            <ArrowRight size={17} />{connected.includes(model) ? 'Начать собеседование' : 'Подключить модель'}
          </Button>
        </div>
        <div aria-hidden="true" className="hero-grid absolute inset-y-12 right-3 hidden w-[51%] xl:block">
          <div className="absolute top-2 left-[15%] flex h-44 w-2/3 rotate-[11deg] items-start gap-9 rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-4 text-sm text-neutral-400">
            <span className="grid size-8 place-items-center rounded-lg bg-neutral-800"><MessageCircle size={15} /></span>Вопрос интервьюера
          </div>
          <div className="absolute right-[12%] bottom-1 w-[77%] -rotate-[7deg] rounded-2xl border border-amber-400/30 bg-neutral-900 p-4 shadow-[0_14px_26px_-12px_rgb(251_191_36/0.35)]">
            <div className="flex items-center gap-3 border-b border-neutral-700 pb-3 text-sm font-medium">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-400/10 text-amber-400"><Zap size={16} /></span>Ответ агента
            </div>
            <p className="mt-3 text-xs text-amber-400">Тезис</p>
            <p className="mt-2 text-2xl leading-tight font-bold">Индекс ускоряет чтение</p>
            <p className="mt-3 mb-2 text-sm text-neutral-400">Объяснение и пример ниже</p>
          </div>
        </div>
      </section>
      <ModelPicker selected={model} connected={connected} onSelect={onSelect} />
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2">
        <div className="flex items-center gap-3"><FileText size={18} className="text-neutral-400" />
          <div><h2 className="text-sm font-medium">Материалы собеседования</h2><p className="mt-1 text-xs text-neutral-400">Резюме и список вопросов</p></div>
        </div>
        <Button onClick={onMaterials}><ArrowRight size={16} />Открыть материалы</Button>
      </section>
    </div>
  )
}
