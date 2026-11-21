import { useState } from 'react'
import { BookOpen, House, MessageCircle, Settings, SquarePlay, UserRound } from 'lucide-react'
import type { InterviewPage } from './Interviews'

export const pages = [
  { id: 'home', title: 'Главная', icon: House },
  { id: 'chat', title: 'Собеседование', icon: MessageCircle },
  { id: 'materials', title: 'Материалы', icon: BookOpen },
  { id: 'settings', title: 'Настройки агента', icon: Settings },
  { id: 'records', title: 'Записи', icon: SquarePlay },
  { id: 'profile', title: 'Профиль', icon: UserRound },
] as const

export type Page = (typeof pages)[number]['id'] | 'usage' | 'usage/models' | 'profile/materials' | InterviewPage

export function Sidebar({ page, navigate }: { page: Page; navigate: (next: Page) => void }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase('ru')
  const matches = pages.filter(({ title }) => title.toLocaleLowerCase('ru').includes(query))

  return (
    <aside className="flex shrink-0 flex-col border-b border-neutral-800 bg-[#121212] sm:w-[222px] sm:border-r sm:border-b-0">
      <div className="flex min-h-14 items-center px-4 sm:min-h-[78px] sm:px-5">
        <a href="#home" onClick={() => navigate('home')} className="inline-flex items-center gap-2.5 text-lg font-semibold">
          <span className="grid size-[34px] place-items-center rounded-full bg-amber-400 text-neutral-950"><MessageCircle size={16} /></span>Реплика
        </a>
      </div>
      <form className="hidden px-5 pt-2.5 pb-3 sm:block" onSubmit={(event) => {
        event.preventDefault()
        if (matches[0]) {
          navigate(matches[0].id)
          setSearch('')
        }
      }}>
        <input type="search" className="w-full border-b border-neutral-700 bg-transparent px-1 py-2.5 text-sm placeholder:text-neutral-400"
          placeholder="Найти раздел..." aria-label="Найти раздел" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
      </form>
      <nav aria-label="Разделы" className="flex min-h-0 gap-1 overflow-auto overscroll-x-none px-3 pb-3 sm:flex-col sm:gap-[3px] sm:px-5">
        {matches.map(({ id, title, icon: Icon }) => {
          const current = page === id || (id === 'profile' && (page.startsWith('usage') || page.startsWith('profile/')))
          return (
            <div key={id} className={`shrink-0 ${id === 'profile' && !query ? 'sm:mt-4 sm:border-t sm:border-neutral-800 sm:pt-4' : ''}`}>
              <a href={`#${id}`} aria-current={current ? 'page' : undefined} onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                navigate(id)
                setSearch('')
              }}
                className="group relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm whitespace-nowrap text-neutral-400 hover:bg-neutral-800 aria-[current=page]:font-semibold aria-[current=page]:text-neutral-100">
                {current && <span aria-hidden="true" className="absolute left-0 h-[18px] w-0.5 rounded-full bg-amber-400" />}
                <Icon size={15} className={current ? 'text-amber-400' : ''} />{title}
              </a>
            </div>
          )
        })}
        {!matches.length && <p className="px-1 text-sm text-neutral-400">Разделы не найдены</p>}
      </nav>
    </aside>
  )
}
