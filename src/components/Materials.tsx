import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FileText, MessageCircle, MoreHorizontal, Plus, Upload } from 'lucide-react'
import { Button, fieldClass, Input, Modal } from './ui'

export interface TrainingQuestion {
  text: string
  topic: string
}

export const sampleQuestions: TrainingQuestion[] = [
  { text: 'Когда индекс может замедлить базу данных?', topic: 'Базы данных' },
  { text: 'Как вы диагностируете медленный запрос?', topic: 'Базы данных' },
  { text: 'Расскажите о сложном решении в вашем последнем проекте.', topic: 'Опыт' },
]

export interface Resume {
  name: string
  text: string
}

export const sampleResume: Resume = {
  name: 'resume_demo.pdf',
  text: 'Демо-резюме. Проектировал базы данных, анализировал запросы и работал над улучшением времени отклика.',
}

interface Props {
  inProfile?: boolean
  resume: Resume | null
  questions: readonly TrainingQuestion[]
  onResume: (resume: Resume | null) => void
  onQuestions: (questions: TrainingQuestion[]) => void
}

export function Materials({ inProfile, resume, questions, onResume, onQuestions }: Props) {
  const resumeInput = useRef<HTMLInputElement>(null)
  const questionsInput = useRef<HTMLInputElement>(null)
  const [issue, setIssue] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [questionDraft, setQuestionDraft] = useState<TrainingQuestion>({ text: '', topic: '' })
  const [showResumeActions, setShowResumeActions] = useState(false)

  function edit(index: number) {
    setEditing(index)
    setQuestionDraft(questions[index] ?? { text: '', topic: '' })
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>, kind: 'resume' | 'questions') {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setIssue('')

    try {
      if (file.size > 1024 * 1024) throw new Error('Выберите файл размером до 1 МБ.')
      if (kind === 'resume') {
        const pdf = /\.pdf$/i.test(file.name)
        if (!pdf && !/\.txt$/i.test(file.name)) throw new Error('Выберите PDF или TXT.')
        onResume({ name: file.name, text: pdf ? '' : (await file.text()).slice(0, 12000) })
        return
      }
      if (!/\.txt$/i.test(file.name)) throw new Error('Для списка вопросов выберите TXT.')
      const entries = (await file.text()).split(/\r?\n/).map((text) => text.trim()).filter(Boolean)
      if (!entries.length) throw new Error('Добавьте по одному вопросу на строку в текстовом файле.')
      onQuestions([...questions, ...entries.slice(0, 100).map((text) => ({ text: text.slice(0, 500), topic: '' }))])
    } catch (reason) {
      setIssue(reason instanceof Error ? reason.message : 'Не удалось прочитать файл.')
    }
  }

  return (
    <section>
      {inProfile ? <h2 className="text-2xl font-semibold">Материалы</h2> : <h1 className="text-4xl font-bold">Материалы</h1>}
      <p className="mt-3 text-[15px] text-neutral-400">Резюме и вопросы, которые агент может учитывать в ответах.</p>
      {issue && <p role="alert" className="mt-4 text-sm text-red-300">{issue}</p>}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <h2 className="text-[22px] font-semibold">Резюме</h2>
          <Button onClick={() => resumeInput.current?.click()}><Upload size={14} className="text-amber-400" />Загрузить резюме</Button>
          <input ref={resumeInput} className="hidden" type="file" accept=".txt,.pdf" onChange={(event) => void loadFile(event, 'resume')} />
        </div>
        {resume ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-neutral-900 p-3">
            <span className="grid size-10 place-items-center rounded-lg bg-amber-400/8 text-amber-400"><FileText size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold [overflow-wrap:anywhere]">{resume.name}</p>
              <p className="mt-1 text-xs text-neutral-400">{resume.text ? 'Доступно для контекста' : 'PDF · в демо отображается имя файла'}</p>
            </div>
            <Button aria-expanded={showResumeActions} aria-label="Действия с резюме" onClick={() => setShowResumeActions(!showResumeActions)}><MoreHorizontal size={16} /></Button>
            {showResumeActions && <Button onClick={() => { onResume(null); setShowResumeActions(false) }}>Убрать резюме</Button>}
          </div>
        ) : <p className="mt-3 text-sm text-neutral-400">Резюме пока не добавлено.</p>}
      </section>
      <section className="mt-12">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 pb-4">
          <div><h2 className="text-[22px] font-semibold">Подготовленные вопросы</h2><p className="mt-1 text-xs text-neutral-400">Вопросов: {questions.length}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => questionsInput.current?.click()}><Upload size={14} className="text-amber-400" />Импорт списка</Button>
            <input ref={questionsInput} className="hidden" type="file" accept=".txt" onChange={(event) => void loadFile(event, 'questions')} />
            <Button variant="primary" onClick={() => edit(questions.length)}><Plus size={15} />Добавить вопрос</Button>
          </div>
        </div>
        <ul>
          {questions.map(({ text, topic }, index) => (
            <li key={index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-neutral-800 py-3 sm:grid-cols-[auto_1fr_9rem_auto]">
              <MessageCircle size={14} className="text-neutral-400" />
              <span className="text-sm font-medium [overflow-wrap:anywhere]">{text}</span>
              <span className="hidden text-xs text-neutral-400 sm:block [overflow-wrap:anywhere]">{topic}</span>
              <Button className="min-h-9 px-2.5" aria-label={`Редактировать вопрос ${index + 1}`} onClick={() => edit(index)}><MoreHorizontal size={15} /></Button>
            </li>
          ))}
        </ul>
        {editing !== null && <Modal titleId="question-editor-title" className="border-neutral-700" onClose={() => setEditing(null)}>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault()
            if (!questionDraft.text.trim()) return
            const next = { text: questionDraft.text.trim(), topic: questionDraft.topic.trim() }
            onQuestions(editing === questions.length ? [...questions, next] : questions.map((item, index) => index === editing ? next : item))
            setEditing(null)
          }}>
            <h3 id="question-editor-title" className="text-2xl font-semibold">{editing === questions.length ? 'Новый вопрос' : 'Редактировать вопрос'}</h3>
            <label className="space-y-1 text-sm"><span>Вопрос</span><textarea required rows={2} maxLength={500} className={fieldClass}
              value={questionDraft.text} onChange={(event) => setQuestionDraft({ ...questionDraft, text: event.currentTarget.value })} /></label>
            <label className="space-y-1 text-sm"><span>Тема</span><Input maxLength={80} value={questionDraft.topic}
              onChange={(event) => setQuestionDraft({ ...questionDraft, topic: event.currentTarget.value })} /></label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-700 pt-4">
              {editing < questions.length && <Button variant="ghost" className="mr-auto text-red-300" onClick={() => {
                onQuestions(questions.filter((_, index) => index !== editing))
                setEditing(null)
              }}>Удалить</Button>}
              <Button onClick={() => setEditing(null)}>Отмена</Button>
              <Button variant="primary" type="submit">Сохранить</Button>
            </div>
          </form>
        </Modal>}
      </section>
    </section>
  )
}
