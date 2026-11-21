import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import type { Company } from '../companies'
import { collectQuestions, interviewDate, interviewSummary } from '../interviews'
import type { InterviewLog, InterviewQuestion } from '../interviews'
import { CompanyLogo } from './CompanyPicker'

export type InterviewPage = 'profile/interviews' | 'profile/interviews/questions'
  | `profile/interviews/company/${string}` | `profile/interviews/question/${string}` | `profile/interviews/dialogue/${string}`

const root = '#profile/interviews'
const library = `${root}/questions`
const companyLink = (id: string) => `${root}/company/${id}`
const questionLink = (id: string) => `${root}/question/${id}`
const dateLabel = (value: string) => interviewDate.format(new Date(value))
const plurals = new Intl.PluralRules('ru-RU')
function countLabel(count: number, forms: [string, string, string]) {
  const form = plurals.select(count)
  return `${count} ${forms[form === 'one' ? 0 : form === 'few' ? 1 : 2]}`
}
const questionCount = (count: number) => countLabel(count, ['вопрос', 'вопроса', 'вопросов'])
const dialogueCount = (count: number) => countLabel(count, ['диалог', 'диалога', 'диалогов'])
const linkStyle = 'inline-flex items-center gap-2 rounded-sm text-sm font-medium text-amber-400 hover:text-amber-300'
const bankButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium hover:border-neutral-500 hover:bg-neutral-800'

function BackLink({ href = root, text = 'К собеседованиям' }: { href?: string; text?: string }) {
  return <a href={href} className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-100"><ArrowLeft size={14} />{text}</a>
}

function QuestionsGrid({ questions, companies, showCompany }: { questions: InterviewQuestion[]; companies: readonly Company[]; showCompany: boolean }) {
  return questions.length ? (
    <ul className="grid gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3">
      {questions.map((question) => {
        const name = companies.find(({ id }) => id === question.companyId)?.name
        return <li key={question.id} className="flex min-w-0">
          <a href={questionLink(question.id)} className="flex min-h-[166px] w-full flex-col rounded-[13px] border border-neutral-800 bg-[#121212] p-4 hover:border-neutral-600">
            <p className="text-xs text-neutral-400">{question.topic || 'Без темы'}</p>
            <h3 className="mt-2 mb-4 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">{question.title}</h3>
            <div className="border-t border-neutral-800 pt-2.5 text-xs text-neutral-400">
              {showCompany && name && <>{name} · </>}{dateLabel(question.at)}{question.demo && ' · Демо'}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{question.level ?? 'Сложность не оценена'}</span><span className="font-medium text-amber-400">Открыть</span>
            </div>
          </a>
        </li>
      })}
    </ul>
  ) : <p className="panel text-sm text-neutral-400">Вопросы появятся после первого ответа в диалоге с этой компанией.</p>
}

function QuestionDetail({ question, company }: { question: InterviewQuestion; company: Company }) {
  const { title, topic, level, at, description, answer, demo } = question
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <BackLink href={library} text="Вся база вопросов" />
      <a href={companyLink(company.id)} className={linkStyle}>К вопросам компании <ArrowRight size={13} /></a>
    </div>
    <h2 className="text-2xl font-semibold [overflow-wrap:anywhere] sm:text-[30px]">{title}</h2>
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-[#121212] p-4 sm:grid-cols-4">
      {[['Компания', company.name], ['Тема', topic || 'Без темы'], ['Сложность', level ?? 'Не оценена'], ['Диалог', dateLabel(at)]].map(([label, value]) =>
        <div key={label} className="min-w-0 sm:border-r sm:border-neutral-800 sm:last:border-0">
          <dt className="text-xs text-neutral-400">{label}</dt><dd className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]">{value}</dd>
        </div>)}
    </dl>
    {description && <div><h3 className="font-semibold">Описание</h3><p className="mt-2 text-sm text-neutral-400">{description}</p></div>}
    <article className="panel space-y-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <h3 className="text-lg font-semibold">Ответ</h3>
      <p className="whitespace-pre-line">{answer.summary}</p>
      {answer.explanation && <p className="text-neutral-300">{answer.explanation}</p>}
      {answer.example && <div className="border-t border-neutral-800 pt-3"><h4 className="font-medium text-amber-400">Пример</h4><p className="mt-1 text-neutral-400">{answer.example}</p></div>}
    </article>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold">Источник</h3><p className="mt-1 text-sm text-neutral-400">{demo ? 'Демонстрационный диалог' : 'Вопрос из диалога'} · {company.name}, {dateLabel(at)}</p></div>
      <a href={`${root}/dialogue/${question.id}`} className={linkStyle}>Открыть {demo ? 'пример диалога' : 'исходный диалог'} <ArrowRight size={14} /></a>
    </div>
  </section>
}

export function Interviews({ page, companies, interviews }: { page: InterviewPage; companies: readonly Company[]; interviews: readonly InterviewLog[] }) {
  const questions = collectQuestions(interviews)
  const id = page.split('/').at(-1)

  if (page.includes('/question/') || page.includes('/dialogue/')) {
    const question = questions.find((item) => item.id === id) ?? interviews.flatMap((session) => session.questions).find((item) => item.id === id)
    const company = companies.find((item) => item.id === question?.companyId)
    if (!question || !company) return <><BackLink href={library} text="Вся база вопросов" /><p className="mt-3 text-sm text-neutral-400">Вопрос не найден.</p></>
    if (page.includes('/question/')) return <QuestionDetail question={question} company={company} />
    const entries = interviews.find((session) => session.questions.some((item) => item.id === id))?.questions ?? [question]
    return <section className="space-y-5">
      <BackLink href={questionLink(question.id)} text="К вопросу" />
      <h2 className="text-2xl font-semibold">{question.demo ? 'Пример диалога' : 'Исходный диалог'}</h2>
      <p className="text-sm text-neutral-400">{company.name} · {dateLabel(question.at)}</p>
      {entries.map((entry) => <article key={entry.id} className="panel space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
        <h3 className="font-semibold">{entry.title}</h3><p className="whitespace-pre-line text-neutral-300">{entry.answer.summary}</p>
        {entry.answer.explanation && <p className="text-neutral-400">{entry.answer.explanation}</p>}
        {entry.answer.example && <p className="text-neutral-400">{entry.answer.example}</p>}
      </article>)}
    </section>
  }

  if (page !== 'profile/interviews') {
    const isLibrary = page === 'profile/interviews/questions'
    const company = companies.find((item) => item.id === id)
    if (!isLibrary && !company) return <><BackLink /><p className="mt-3 text-sm text-neutral-400">Компания не найдена.</p></>
    const visible = isLibrary ? questions : questions.filter(({ companyId }) => companyId === company?.id)
    return <section className="space-y-5">
      <BackLink />
      <header>
        <h2 className="company-logo-target flex items-center gap-3 text-2xl font-semibold [overflow-wrap:anywhere]">
          {company && <CompanyLogo company={company} className="size-9" />}{company?.name ?? 'Вся база вопросов'}
        </h2>
        <p className="mt-2 text-sm text-neutral-400">{questionCount(visible.length)} из диалогов</p>
      </header>
      <QuestionsGrid questions={visible} companies={companies} showCompany={isLibrary} />
      {!isLibrary && <a href={library} className={bankButton}>Вся база вопросов</a>}
    </section>
  }

  const cards = companies.map((company) => ({
    company,
    ...interviewSummary(company.id, interviews),
    questions: questions.filter((question) => question.companyId === company.id).length,
  })).filter((card) => card.count > 0)
  const total = cards.reduce((count, card) => count + card.count, 0)
  return <section className="space-y-6">
    <header>
      <h2 className="text-2xl font-semibold">Собеседования</h2>
      <p className="mt-2 text-sm text-neutral-400">{countLabel(cards.length, ['компания', 'компании', 'компаний'])} · {dialogueCount(total)} · {questionCount(questions.length)}</p>
    </header>
    <ul className="grid gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ company, count, questions: amount, last }) => (
        <li key={company.id} className="min-w-0">
          <a href={companyLink(company.id)} className="company-logo-target block h-full rounded-2xl border border-neutral-800 bg-[#121212] p-3 hover:border-neutral-600">
            <div className="relative isolate grid h-27 place-items-center rounded-xl border border-neutral-800 bg-neutral-900/65">
              <span aria-hidden="true" className="absolute -z-10 size-14 -translate-x-3 -rotate-12 rounded-xl border border-neutral-700 bg-neutral-800" />
              <span aria-hidden="true" className="absolute -z-10 size-14 translate-x-3 rotate-12 rounded-xl border border-neutral-700 bg-neutral-800" />
              <span className="grid size-[60px] place-items-center rounded-[14px] border border-neutral-700 bg-neutral-800 shadow-md">
                <CompanyLogo company={company} className="size-[38px]" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-1 py-3">
              <h3 className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">{company.name}</h3>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-400">К вопросам <ArrowRight size={12} /></span>
            </div>
            <div className="space-y-3 border-t border-neutral-800 px-1 py-3 text-xs text-neutral-400">
              <div className="flex flex-wrap justify-between gap-2"><span>{dialogueCount(count)}</span><span className="text-neutral-200">{questionCount(amount)}</span></div>
              {last && <p>Последний диалог · {dateLabel(last)}</p>}
            </div>
          </a>
        </li>
      ))}
    </ul>
    <a href={library} className={bankButton}>Вся база вопросов</a>
  </section>
}
