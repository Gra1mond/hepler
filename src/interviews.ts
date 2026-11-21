import type { Answer } from './backend'

export interface InterviewQuestion {
  id: string
  companyId: string
  title: string
  topic: string
  at: string
  answer: Answer
  level?: string
  description?: string
  demo?: boolean
}

export interface InterviewLog {
  id: string
  companyId: string
  startedAt: string
  questions: InterviewQuestion[]
}

export const interviewDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

export function readInterviewLog(value: unknown): InterviewLog[] {
  if (!Array.isArray(value)) return []
  return value.filter((session): session is InterviewLog => typeof session?.id === 'string'
    && typeof session.companyId === 'string' && typeof session.startedAt === 'string'
    && Number.isFinite(Date.parse(session.startedAt)) && Array.isArray(session.questions))
    .map((session) => ({
      ...session,
      questions: session.questions.filter((question) => typeof question?.id === 'string'
        && question.companyId === session.companyId && typeof question.title === 'string'
        && typeof question.topic === 'string' && typeof question.at === 'string'
        && Number.isFinite(Date.parse(question.at)) && typeof question.answer?.summary === 'string'),
    }))
}

export const normalizeQuestion = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')

const examples: InterviewQuestion[] = [
  {"id":"sample-1","companyId":"yandex","topic":"Базы данных","title":"Когда индекс может замедлить базу данных?","level":"Средний","at":"2026-11-19T12:00:00Z","description":"Проверяет понимание того, что ускорение чтения может повысить стоимость записи.","answer":{"summary":"При вставке, удалении и изменении индексируемых полей СУБД обновляет индексы. Чем их больше, тем дороже запись. Особенно это заметно на массовой загрузке.","example":"Сравните время загрузки на одинаковом наборе данных с нужными индексами и без лишних. Учитывайте, что удаление индекса может замедлить чтение."},"demo":true},
  {"id":"sample-2","companyId":"yandex","topic":"Базы данных","title":"Как проверить, использует ли запрос индекс?","level":"Базовый","at":"2026-11-19T12:00:00Z","description":"Нужно объяснить, как читать план выполнения и найти выбранный индекс.","answer":{"summary":"Посмотрите план выполнения. В PostgreSQL ищите Index Scan, Index Only Scan или Bitmap Index Scan и имя индекса. Seq Scan означает последовательное чтение таблицы.","example":"Если планировщик выбрал Seq Scan, проверьте селективность фильтра и актуальность статистики."},"demo":true},
  {"id":"sample-3","companyId":"yandex","topic":"Проектирование","title":"Как обеспечить идемпотентность API?","level":"Средний","at":"2026-11-13T12:00:00Z","description":"Задача про безопасные повторы запроса при тайм-аутах и сбоях.","answer":{"summary":"Клиент отправляет ключ идемпотентности. Сервер связывает его с операцией и сохраняет результат атомарно. При повторе с тем же ключом и теми же параметрами возвращается сохранённый результат.","example":"Если два запроса приходят одновременно, уникальное ограничение на ключ помогает избежать двойного выполнения."},"demo":true},
  {"id":"sample-4","companyId":"yandex","topic":"Проектирование","title":"Как спроектировать очередь с повторными попытками?","level":"Продвинутый","at":"2026-11-13T12:00:00Z","description":"Нужно учесть временные сбои, дубли и сообщения, которые постоянно падают.","answer":{"summary":"Разделите временные и постоянные ошибки. Для временных используйте ограниченное число повторов с возрастающей задержкой и случайным разбросом. После лимита отправляйте сообщение в очередь ошибок.","example":"Подтверждайте сообщение после успешной обработки. Обработчик должен выдерживать повторную доставку."},"demo":true},
  {"id":"sample-5","companyId":"yandex","topic":"Опыт","title":"Расскажите о сложном сбое в продакшене","level":"Средний","at":"2026-11-19T12:00:00Z","description":"Интервьюер оценивает, как вы диагностируете сбой и взаимодействуете с командой.","answer":{"summary":"Опишите реальный сбой: его влияние, вашу роль, первые действия, способ устранения и результат. Отдельно объясните, что команда изменила, чтобы сбой не повторился.","example":"Назовите один измеримый результат, если он у вас есть: время восстановления или изменение частоты ошибок."},"demo":true},
  {"id":"sample-6","companyId":"yandex","topic":"Опыт","title":"Как вы решали спор об архитектуре в команде?","level":"Средний","at":"2026-11-13T12:00:00Z","description":"Вопрос о принятии решений, когда есть несколько разумных технических вариантов.","answer":{"summary":"Выберите реальный спор. Покажите, как команда согласовала критерии, сравнила варианты и проверила спорные предположения. Завершите тем, что решили и какой эффект увидели.","example":"Уточните свою роль и объясните, при каких условиях вы пересмотрели бы решение."},"demo":true},
  {"id":"sample-7","companyId":"ozon","topic":"Проектирование","title":"Как ограничить поток запросов к API?","level":"Средний","at":"2026-11-16T12:00:00Z","description":"Проверяет выбор алгоритма и поведение API при превышении лимита.","answer":{"summary":"Определите ключ лимита и допустимую нагрузку. Для управляемых всплесков подойдёт token bucket. При превышении возвращайте HTTP 429 и указывайте, когда можно повторить запрос.","example":"Если API развёрнут на нескольких узлах, отдельно объясните, где хранится состояние лимита."},"demo":true},
  {"id":"sample-8","companyId":"ozon","topic":"Проектирование","title":"Как выбрать стратегию кеширования каталога?","level":"Продвинутый","at":"2026-11-16T12:00:00Z","description":"Нужно показать, как вы выбираете срок жизни данных и способ обновления кеша.","answer":{"summary":"Оцените частоту чтения и допустимую устарелость. Для описаний товаров можно начать с cache-aside и TTL. Для цены и остатков имеет смысл отдельно продумать обновление по событиям.","example":"Продумайте одновременные промахи по популярному товару: объединение запросов уменьшит нагрузку на источник."},"demo":true},
  {"id":"sample-9","companyId":"ozon","topic":"Опыт","title":"Как вы находили причину медленной загрузки?","level":"Средний","at":"2026-11-16T12:00:00Z","description":"Вопрос о диагностике производительности на реальном проекте.","answer":{"summary":"Опишите, как воспроизвели задержку, измерили этапы загрузки и нашли узкое место. Расскажите, что изменили и каким повторным замером проверили результат.","example":"Разделите вклад сети, сервера и клиентского рендера, если измеряли их отдельно."},"demo":true},
  {"id":"sample-10","companyId":"avito","topic":"Базы данных","title":"Чем блокировка отличается от взаимной блокировки?","level":"Базовый","at":"2026-11-11T12:00:00Z","description":"Нужно отличить обычное ожидание ресурса от циклического ожидания.","answer":{"summary":"При блокировке транзакция ждёт освобождения ресурса. При взаимной блокировке транзакции ждут друг друга по циклу. СУБД обычно разрывает цикл, отменяя одну транзакцию.","example":"Пример: одна транзакция захватила строку A и ждёт B, вторая захватила B и ждёт A."},"demo":true},
  {"id":"sample-11","companyId":"avito","topic":"Опыт","title":"Как вы оценили результат технических изменений?","level":"Средний","at":"2026-11-11T12:00:00Z","description":"Проверяет, как вы связываете техническую работу с измеримым эффектом.","answer":{"summary":"Опишите исходную проблему, выбранную метрику и базовый замер. После изменения сравните показатели в сопоставимых условиях и проверьте, не ухудшились ли связанные метрики.","example":"Например, сравните p95 задержки до и после, сверив объём нагрузки и долю ошибок."},"demo":true},
]

export function collectQuestions(interviews: readonly InterviewLog[]) {
  const unique = new Map<string, InterviewQuestion>()
  for (const question of [...examples, ...interviews.flatMap((session) => session.questions)]) {
    const key = `${question.companyId}:${normalizeQuestion(question.title)}`
    const previous = unique.get(key)
    if (!previous || previous.demo || Date.parse(previous.at) <= Date.parse(question.at)) unique.set(key, question)
  }
  return [...unique.values()]
}

export function interviewSummary(companyId: string, interviews: readonly InterviewLog[]) {
  const sessions = interviews.filter((session) => session.companyId === companyId)
  const dates = [...new Set(examples.filter((item) => item.companyId === companyId).map((item) => item.at))]
  const last = [...sessions.map(({ startedAt }) => startedAt), ...dates].sort().at(-1)
  return { count: sessions.length + dates.length, last }
}
