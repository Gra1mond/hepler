import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { createDemoBackend } from './backend'
import type { ReplicaBackend } from './backend'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

async function connectDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Подключить модель' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Добавить API-подключение' }))
  await user.click(dialog.getByRole('button', { name: 'Демо-ключ' }))
  await user.click(dialog.getByRole('button', { name: 'Добавить' }))
  await screen.findByText('GPT подключена')
}

async function startChatWithoutCompany(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('link', { name: 'Собеседование' }))
  await user.click(screen.getByRole('button', { name: 'Без компании' }))
}

test('после подключения модели пользователь может отправить вопрос и получить ответ', async () => {
  const user = userEvent.setup()
  const backend: ReplicaBackend = {
    connect: vi.fn().mockResolvedValue(undefined),
    answer: vi.fn().mockResolvedValue({
      summary: 'Сначала опишите решение.',
      explanation: 'Объясните компромиссы.',
      example: 'Приведите измеримый результат.',
    }),
  }

  render(<App backend={backend} />)
  await connectDemo(user)

  await startChatWithoutCompany(user)
  await user.type(screen.getByRole('textbox', { name: 'Вопрос' }), 'Как объяснить решение?{Enter}')

  expect(await screen.findByText('Сначала опишите решение.')).toBeTruthy()
  expect(screen.getByText('Как объяснить решение?')).toBeTruthy()
})

test('чат показывает ожидание, сохраняет вопрос после ошибки и повторяет запрос', async () => {
  const user = userEvent.setup()
  let rejectFirst: (reason: Error) => void = () => {}
  const firstReply = new Promise<never>((_resolve, reject) => { rejectFirst = reject })
  const backend: ReplicaBackend = {
    connect: vi.fn().mockResolvedValue(undefined),
    answer: vi.fn()
      .mockReturnValueOnce(firstReply)
      .mockResolvedValueOnce({ summary: 'Ответ после повторной отправки.' }),
  }

  render(<App backend={backend} />)
  await connectDemo(user)
  await startChatWithoutCompany(user)
  await user.type(screen.getByRole('textbox', { name: 'Вопрос' }), 'Как рассказать о проекте?{Enter}')
  expect(screen.getByRole('status').textContent).toContain('Агент готовит ответ')

  rejectFirst(new Error('Сбой сервиса'))
  expect((await screen.findByRole('alert')).textContent).toContain('Не удалось получить ответ')
  await user.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByText('Ответ после повторной отправки.')).toBeTruthy()
  expect(screen.getAllByText('Как рассказать о проекте?')).toHaveLength(1)
})

test('локальное демо имитирует один сбой, после которого повтор проходит', async () => {
  const user = userEvent.setup()
  render(<App backend={createDemoBackend()} />)
  await connectDemo(user)
  await user.click(screen.getByRole('button', { name: 'Сбой следующего ответа' }))
  await startChatWithoutCompany(user)
  await user.type(screen.getByRole('textbox', { name: 'Вопрос' }), 'Как подготовиться?{Enter}')
  expect(await screen.findByRole('alert', {}, { timeout: 2500 })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByRole('article', { name: 'Ответ модели' }, { timeout: 2500 })).toBeTruthy()
}, 8000)
