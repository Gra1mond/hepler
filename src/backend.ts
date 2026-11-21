export const models = [
  { id: 'gpt', name: 'GPT', provider: 'OpenAI' },
  { id: 'claude', name: 'Claude', provider: 'Anthropic' },
  { id: 'gemini', name: 'Gemini', provider: 'Google' },
  { id: 'mistral', name: 'Mistral', provider: 'Mistral AI' },
] as const

export type ModelId = (typeof models)[number]['id']
export const answerFormats = ['Краткий', 'Структурированный', 'Развёрнутый'] as const
export type AnswerFormat = (typeof answerFormats)[number]

export interface AnswerRequest {
  question: string
  model: ModelId
  format: AnswerFormat
  materials?: string
}

export interface Answer {
  summary: string
  explanation?: string
  example?: string
}

export interface ReplicaBackend {
  connect(model: ModelId, demoCode: string): Promise<void>
  answer(request: AnswerRequest, signal?: AbortSignal): Promise<Answer>
}

export interface DemoControls {
  failNextAnswer(): void
}

export const demoCode = 'replica-demo'
export const unavailableDemoCode = 'replica-offline'

const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal?.throwIfAborted()
  function abort() {
    clearTimeout(timer)
    reject(signal?.reason)
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', abort)
    resolve()
  }, milliseconds)
  signal?.addEventListener('abort', abort, { once: true })
})

export function createDemoBackend(): ReplicaBackend & DemoControls {
  let failOnce = false
  return {
    failNextAnswer() { failOnce = true },
    async connect(_model, code) {
      await wait(450)
      if (code.trim() === unavailableDemoCode) throw new Error('model-unavailable')
      if (code.trim() !== demoCode) {
        throw new Error('Для демонстрации используйте демо-ключ.')
      }
    },
    async answer({ question, format, materials }, signal) {
      const shouldFail = failOnce
      failOnce = false
      await wait(1000, signal)
      if (shouldFail) throw new Error('Демонстрационный сбой модели.')
      const aboutIndex = /индекс/i.test(question)
      const summary = aboutIndex
        ? 'Индекс ускоряет чтение,\nно может замедлять запись.'
        : 'Назовите свою роль, опишите решение и завершите измеримым результатом.'
      if (format === 'Краткий') return { summary }

      if (aboutIndex) return {
        summary,
        explanation: 'При вставке, удалении или изменении индексируемого значения база обновляет затронутые индексы.',
        example: 'Массовая загрузка в таблицу с несколькими индексами может занять больше времени, чем загрузка в таблицу без них.',
      }

      return {
        summary,
        explanation: materials
          ? 'Выберите из материалов проект, в котором хорошо виден ваш личный вклад. Объясните, почему вы приняли именно это решение.'
          : format === 'Развёрнутый'
            ? 'Опишите исходную задачу и свою ответственность. Затем перечислите варианты, объясните критерии выбора и завершите результатом. Если точной метрики нет, укажите, как вы оценивали эффект.'
            : 'Начните с контекста задачи, затем объясните, почему выбрали этот подход и чем он помог команде.',
        example: 'Я разобрал причины повторных обращений, изменил шаг проверки и сократил число повторов на 20%.',
      }
    },
  }
}
