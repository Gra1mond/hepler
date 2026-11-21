import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Building2, Check, Plus, Upload, X } from 'lucide-react'
import { companyNameLimit, prepareCompanyLogo } from '../companies'
import type { Company } from '../companies'
import { Button, Input, Modal } from './ui'

export function CompanyLogo({ company, className = '' }: { company: Pick<Company, 'name' | 'logo'>; className?: string }) {
  const [brokenLogo, setBrokenLogo] = useState<string>()
  const initials = company.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('ru')

  return (
    <span aria-hidden="true" className={`company-logo grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-800 text-xs font-semibold text-neutral-200 ${className}`}>
      {company.logo && company.logo !== brokenLogo
        ? <img alt="" src={company.logo} className="size-full object-contain" onError={() => setBrokenLogo(company.logo)} />
        : initials || <Building2 size={17} />}
    </span>
  )
}

interface PickerProps {
  companies: readonly Company[]
  onClose: () => void
  onStart: (company: Company | null) => void
}

export function CompanyPicker({ companies, onClose, onStart }: PickerProps) {
  const [selected, setSelected] = useState<Company | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<{ url: string; filename: string }>()
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const fileRead = useRef(0)
  const canStart = adding ? !!name.trim() && !reading : !!selected

  useEffect(() => () => { fileRead.current++ }, [])
  useEffect(() => { if (adding) nameInput.current?.focus() }, [adding])

  function backToCompanies() {
    fileRead.current++
    setReading(false)
    setError('')
    setAdding(false)
    requestAnimationFrame(() => addButton.current?.focus())
  }

  async function selectFile(file: File) {
    const request = ++fileRead.current
    setError('')
    setReading(true)
    try {
      const url = await prepareCompanyLogo(file)
      if (fileRead.current === request) setLogo({ url, filename: file.name })
    } catch (failure) {
      if (fileRead.current === request && failure instanceof Error) setError(failure.message)
    } finally {
      if (fileRead.current === request) setReading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (adding) {
      const label = name.trim()
      if (!label || reading) return
      const existing = companies.find((company) => company.name.toLocaleLowerCase('ru') === label.toLocaleLowerCase('ru'))
      if (existing) {
        setSelected(existing)
        backToCompanies()
        return
      }
      onStart({ id: `custom-${crypto.randomUUID()}`, name: label, logo: logo?.url })
    } else if (selected) {
      onStart(selected)
    }
  }

  return (
    <Modal titleId="company-picker-title" onClose={onClose} className="max-w-[520px] border-neutral-700 bg-[#121212]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="company-picker-title" className="text-xl font-semibold sm:text-2xl">{adding ? 'Новая компания' : 'Компания собеседования'}</h2>
          <p className="mt-2 text-sm text-neutral-400">{adding ? 'Добавьте компанию, которой нет в списке.' : 'Выберите компанию для этого диалога.'}</p>
        </div>
        <Button variant="ghost" className="min-h-8 shrink-0 px-2" aria-label="Закрыть" onClick={onClose}><X size={17} /></Button>
      </div>

      <form onSubmit={submit} className="mt-6">
        {adding ? (
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm text-neutral-300">
              Название компании
              <Input ref={nameInput} value={name} placeholder="Например, Север Лаб" maxLength={companyNameLimit} required
                onChange={(event) => setName(event.currentTarget.value)} />
            </label>
            <div className="grid gap-2">
              <p className="text-sm text-neutral-300">Логотип по желанию</p>
              <div className="company-logo-target flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <CompanyLogo company={{ name, logo: logo?.url }} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={logo?.filename}>{logo?.filename ?? 'Инициалы компании'}</p>
                  <p className="mt-1 text-xs text-neutral-400">{logo ? 'Файл выбран' : 'PNG, JPG или WebP до 5 МБ'}</p>
                </div>
                <input ref={fileInput} hidden type="file" aria-label="Файл логотипа" accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (file) void selectFile(file)
                  }} />
                {logo && <Button variant="ghost" className="min-h-8 px-2" disabled={reading} onClick={() => { setLogo(undefined); setError('') }}>Убрать</Button>}
                <Button variant="accent" className="min-h-8 px-2" disabled={reading} onClick={() => fileInput.current?.click()}>
                  <Upload size={14} />{logo ? 'Заменить' : 'Выбрать файл'}
                </Button>
              </div>
              {reading && <p role="status" className="text-xs text-neutral-400">Открываем изображение…</p>}
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            </div>
          </div>
        ) : (
          <div>
            <p id="companies-label" className="mb-2 text-sm text-neutral-400">Компании</p>
            <div role="group" aria-labelledby="companies-label" className="grid max-h-54 grid-cols-1 gap-2 overflow-y-auto p-1 -m-1 min-[400px]:grid-cols-2">
              {companies.map((company) => (
                <Button key={company.id} aria-pressed={selected?.id === company.id}
                  className="company-logo-target min-h-13 min-w-0 justify-start gap-3 px-2.5 text-left aria-pressed:border-amber-400/50 aria-pressed:bg-amber-400/10 aria-pressed:text-amber-300"
                  onClick={() => setSelected(company)}>
                  <CompanyLogo company={company} />
                  <span className="min-w-0 flex-1 truncate" title={company.name}>{company.name}</span>
                  {selected?.id === company.id && <Check size={15} className="shrink-0 text-amber-400" aria-hidden="true" />}
                </Button>
              ))}
            </div>
            <Button ref={addButton} variant="accent" className="mt-4 px-2" onClick={() => setAdding(true)}><Plus size={16} />Добавить свою компанию</Button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-neutral-800 pt-4">
          {adding
            ? <Button onClick={backToCompanies}><ArrowLeft size={14} />К списку компаний</Button>
            : <Button onClick={() => onStart(null)}>Без компании</Button>}
          <Button type="submit" variant={canStart ? 'primary' : 'secondary'} disabled={!canStart}>Начать диалог</Button>
        </div>
      </form>
    </Modal>
  )
}
