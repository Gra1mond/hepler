import { useEffect, useRef } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

const variants = {
  primary: 'border-amber-400 bg-amber-400 text-neutral-950 enabled:hover:border-amber-300 enabled:hover:bg-amber-300',
  secondary: 'border-neutral-700 bg-neutral-900 text-neutral-100 enabled:hover:border-neutral-500 enabled:hover:bg-neutral-800',
  ghost: 'border-transparent text-neutral-300 enabled:hover:bg-neutral-800 enabled:hover:text-white',
  accent: 'border-transparent text-amber-400 enabled:hover:bg-amber-400/10 enabled:hover:text-amber-300',
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: keyof typeof variants
}

export function Button({ type = 'button', variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button type={type} className={`ui-button inline-flex items-center justify-center gap-2 border font-medium disabled:opacity-45 ${variants[variant]} ${className}`} {...props} />
}

export const fieldClass = 'w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 aria-invalid:border-red-400'

export function Input({ className = '', ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={`${fieldClass} ${className}`} {...props} />
}

interface ModalProps {
  titleId: string
  children: ReactNode
  onClose: () => void
  className?: string
}

export function Modal({ titleId, children, onClose, className = '' }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element || element.open) return
    if (element.showModal) element.showModal()
    else element.setAttribute('open', '')
  }, [])

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[482px] overflow-x-hidden overflow-y-auto overscroll-x-none rounded-[18px] border bg-neutral-900 p-5 text-neutral-100 shadow-xl backdrop:bg-black/70 sm:p-6 ${className}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      {children}
    </dialog>
  )
}
