import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const previewServer = await preview({ preview: { host: '127.0.0.1', port: 0 } })
const { port } = previewServer.httpServer.address()
const url = `http://127.0.0.1:${port}/`
const screenshotDirectory = process.env.REPLICA_SCREENSHOTS
let browser

async function screenshot(page, name) {
  if (!screenshotDirectory) return
  await mkdir(screenshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(screenshotDirectory, name + '.png'), animations: 'disabled' })
}

try {
  browser = await chromium.launch({
    channel: 'msedge',
    chromiumSandbox: true,
    ignoreDefaultArgs: ['--hide-scrollbars'],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  const errors = []
  context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)))
  page.on('pageerror', (error) => errors.push(error.message))
  page.setDefaultTimeout(7000)

  await page.goto(url)
  await page.getByRole('heading', { name: /Услышьте вопрос/ }).waitFor()
  assert.equal(await page.locator('.model-track img').evaluateAll((logos) => logos.every((logo) => logo.complete && logo.naturalWidth > 0)), true)
  await screenshot(page, '01-home')
  await page.getByRole('button', { name: 'Модели справа' }).click()
  await page.getByRole('button', { name: /Mistral/ }).click()
  await page.getByRole('button', { name: 'Подключить модель' }).click()

  const dialog = page.getByRole('dialog', { name: 'Добавить API-подключение' })
  await dialog.getByLabel('Ключ API').fill('bad-demo-code')
  await dialog.getByRole('button', { name: 'Проверить подключение' }).click()
  await dialog.getByRole('alert').getByText(/Демо-ключ не подошёл/).waitFor()
  await dialog.getByRole('button', { name: 'Недоступная модель' }).click()
  await dialog.getByRole('button', { name: 'Проверить подключение' }).click()
  await dialog.getByRole('alert').getByText(/Модель недоступна/).waitFor()
  await screenshot(page, '02-settings-dialog')
  await dialog.getByRole('button', { name: 'Демо-ключ' }).click()
  await dialog.getByRole('button', { name: 'Проверить подключение' }).click()
  await dialog.getByText('Подключение проверено.').waitFor()
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByText('Mistral подключена').waitFor()
  await screenshot(page, '03-settings')

  await page.getByRole('button', { name: 'Сбой следующего ответа' }).click()
  await page.getByRole('link', { name: 'Собеседование' }).click()
  await page.getByRole('button', { name: 'Без компании' }).click()
  await screenshot(page, '04-chat-empty')
  const question = page.getByRole('textbox', { name: 'Вопрос' })
  await question.fill('Когда индекс может замедлить базу данных?')

  const readGlow = (tab) => tab.locator('.composer-glow').evaluate((element) => {
    const styles = getComputedStyle(element)
    return [styles.boxShadow, styles.opacity, styles.animationName]
  })
  const restingGlow = await readGlow(page)
  assert.equal(restingGlow[2], 'none')
  await question.press('Enter')
  await page.getByRole('status').getByText('Агент готовит ответ...').waitFor()
  assert.deepEqual(await readGlow(page), restingGlow)
  await screenshot(page, '05-chat-pending')
  await page.getByRole('alert').getByText('Не удалось получить ответ.').waitFor()
  assert.deepEqual(await readGlow(page), restingGlow)
  assert.equal(await question.inputValue(), 'Когда индекс может замедлить базу данных?')
  await screenshot(page, '06-chat-error')

  await page.getByRole('button', { name: 'Повторить' }).click()
  const answer = page.getByRole('article', { name: 'Ответ модели' })
  await answer.getByText('Индекс ускоряет чтение, но может замедлять запись.').waitFor()
  assert.deepEqual(await readGlow(page), restingGlow)
  await answer.getByRole('button', { name: 'Копировать' }).click()
  await answer.getByText('Скопировано').waitFor()
  await screenshot(page, '07-chat-answer')

  await question.fill('Тест остановки')
  await question.press('Shift+Enter')
  assert.equal(await question.inputValue(), 'Тест остановки\n')
  await question.press('Enter')
  await page.getByRole('button', { name: 'Остановить' }).click()
  assert.equal(await question.inputValue(), 'Тест остановки')
  assert.equal(await page.getByRole('article', { name: 'Ответ модели' }).count(), 1)

  const [compact] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Компактное окно' }).click(),
  ])
  await compact.getByRole('heading', { name: /Компактный чат/ }).waitFor()
  await compact.setViewportSize({ width: 460, height: 680 })
  const compactQuestion = compact.getByRole('textbox', { name: 'Вопрос' })
  await compactQuestion.fill('Как работает индекс?')
  const compactGlow = await readGlow(compact)
  await compactQuestion.press('Enter')
  await compact.getByRole('status').getByText('Агент готовит ответ...').waitFor()
  assert.deepEqual(await readGlow(compact), compactGlow)
  await compact.getByRole('article', { name: 'Ответ модели' }).waitFor()
  assert.deepEqual(await readGlow(compact), compactGlow)
  await screenshot(compact, '08-compact')
  await compact.close()

  await page.getByRole('link', { name: 'Материалы' }).click()
  await page.getByRole('button', { name: 'Добавить вопрос' }).click()
  await page.getByRole('textbox', { name: 'Вопрос' }).fill('Как работает репликация?')
  await page.getByRole('textbox', { name: 'Тема' }).fill('Базы данных')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await page.getByText('Как работает репликация?').waitFor()
  await screenshot(page, '09-materials')
  await page.getByRole('button', { name: 'Редактировать вопрос 4' }).click()
  await page.getByRole('textbox', { name: 'Вопрос' }).fill('Как устроена репликация?')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await page.getByText('Как устроена репликация?').waitFor()
  await page.reload()
  await page.getByText('Как устроена репликация?').waitFor()

  await page.getByRole('searchbox', { name: 'Найти раздел' }).fill('Профиль')
  await page.getByRole('searchbox', { name: 'Найти раздел' }).press('Enter')
  await page.getByRole('heading', { name: 'Личные данные' }).waitFor()
  await screenshot(page, '10-profile')

  const [registration] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Создать аккаунт' }).click(),
  ])
  await registration.setViewportSize({ width: 444, height: 438 })
  await registration.getByRole('textbox', { name: 'Имя' }).fill('Тестовая Анна')
  await registration.getByRole('textbox', { name: 'Электронная почта' }).fill('anna@example.com')
  await registration.getByLabel('Пароль').fill('demo-passphrase')
  assert.equal(await registration.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true)
  await screenshot(registration, '11-registration')
  await registration.getByRole('button', { name: 'Создать аккаунт' }).click()
  await registration.getByText('Данные формы прошли проверку.').waitFor()
  await Promise.all([
    registration.waitForEvent('close', { timeout: 7000 }),
    registration.getByRole('button', { name: 'Закрыть регистрацию' }).click(),
  ])

  const profileTabs = page.getByRole('navigation', { name: 'Разделы профиля' })
  assert.equal(await profileTabs.getByRole('link', { name: 'Данные аккаунта' }).getAttribute('aria-current'), 'page')
  await profileTabs.evaluate((nav) => nav.closest('.overflow-y-auto').scrollTo(0, 0))
  const tabBounds = await profileTabs.boundingBox()
  assert.ok(tabBounds)
  await profileTabs.getByRole('link', { name: 'Использование API' }).click()
  await page.getByRole('heading', { name: 'История использования' }).waitFor()
  assert.deepEqual(await profileTabs.boundingBox(), tabBounds)
  await screenshot(page, '12-usage')
  await page.getByRole('link', { name: 'Детализация по моделям' }).click()
  await page.getByRole('heading', { name: 'Расходы по чатам' }).waitFor()
  assert.deepEqual(await profileTabs.boundingBox(), tabBounds)
  for (const [model, chat] of [
    ['Claude', 'Архитектура приложения'],
    ['GPT', 'Подготовка к собеседованию'],
    ['Gemini', 'Подготовка материалов'],
    ['Mistral', 'Технические вопросы'],
  ]) {
    const card = page.getByRole('button', { name: new RegExp('^' + model) })
    await card.click()
    assert.equal(await card.getAttribute('aria-pressed'), 'true')
    await page.getByRole('heading', { name: chat }).waitFor()
    if (model === 'Claude') await screenshot(page, '12a-usage-models')
  }
  await page.getByRole('link', { name: 'К обзору' }).click()
  await page.getByRole('heading', { name: 'Использование API' }).waitFor()
  await profileTabs.getByRole('link', { name: 'Данные аккаунта' }).click()
  await page.getByRole('heading', { name: 'Личные данные' }).waitFor()
  assert.equal(await profileTabs.getByRole('link', { name: 'Вопросы', exact: true }).count(), 0)
  await profileTabs.getByRole('link', { name: 'Собеседования', exact: true }).click()
  await page.getByRole('heading', { name: 'Собеседования', exact: true }).waitFor()
  await screenshot(page, '12b-profile-interviews')
  await page.getByRole('link', { name: /Яндекс.*К вопросам/ }).click()
  assert.equal(await page.getByRole('heading', { name: 'Яндекс', exact: true }).count(), 1)
  await page.getByRole('link', { name: 'Вся база вопросов', exact: true }).click()
  await page.getByRole('heading', { name: 'Вся база вопросов', exact: true }).waitFor()
  await page.getByRole('link', { name: /Когда индекс может замедлить базу данных/ }).click()
  await page.getByRole('heading', { name: 'Описание' }).waitFor()
  await page.getByText('Средний', { exact: true }).waitFor()
  await profileTabs.getByRole('link', { name: 'Материалы', exact: true }).click()
  await page.getByRole('heading', { name: 'Подготовленные вопросы' }).waitFor()
  await profileTabs.getByRole('link', { name: 'Использование API' }).click()
  await page.getByRole('heading', { name: 'Использование API' }).waitFor()
  await page.getByRole('link', { name: 'Записи' }).click()
  await page.getByRole('heading', { name: 'Записи появятся здесь' }).waitFor()
  await screenshot(page, '13-records')

  await page.getByRole('link', { name: 'Главная' }).click()
  const startInterview = page.getByRole('button', { name: 'Начать собеседование' })
  const picker = page.getByRole('dialog', { name: 'Компания собеседования' })
  await startInterview.click()
  const company = picker.getByRole('button', { name: 'Ozon', exact: true })
  const logo = company.locator('.company-logo')
  await picker.locator('img').last().waitFor()
  assert.equal(await picker.locator('img').count(), 6)
  await page.waitForFunction(() => [...document.querySelectorAll('dialog img')].every((image) => image.complete && image.naturalWidth > 0))
  const originalWidth = (await company.boundingBox()).width
  await company.hover()
  await logo.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  assert.match(await logo.evaluate((element) => getComputedStyle(element).transform), /^matrix\(1\.08, /)
  assert.equal((await company.boundingBox()).width, originalWidth)
  await screenshot(page, '14-company-hover')
  await picker.press('Escape')
  await picker.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.textContent?.includes('Начать собеседование'))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startInterview.click()
  await company.hover()
  assert.equal(await logo.evaluate((element) => getComputedStyle(element).transform), 'none')
  await company.click()
  await picker.getByRole('button', { name: 'Начать диалог' }).click()
  await page.locator('header').getByText('Ozon').waitFor()

  await page.getByRole('link', { name: 'Главная' }).click()
  await startInterview.click()
  await picker.getByRole('button', { name: 'Добавить свою компанию' }).click()
  const customCompany = page.getByRole('dialog', { name: 'Новая компания' })
  await customCompany.getByLabel('Название компании').fill('Север Лаб')
  const logoFile = customCompany.locator('input[type=file]')
  await logoFile.setInputFiles({ name: 'not-a-logo.txt', mimeType: 'text/plain', buffer: Buffer.from('text') })
  await customCompany.getByRole('alert').getByText('Выберите изображение в формате PNG, JPG или WebP.').waitFor()
  await logoFile.setInputFiles({ name: 'sever-lab.png', mimeType: 'image/png', buffer: await readFile('public/companies/yandex.png') })
  await customCompany.getByText('Файл выбран').waitFor()
  await screenshot(page, '15-company-upload')
  await customCompany.getByRole('button', { name: 'Начать диалог' }).click()
  await page.locator('header').getByText('Север Лаб').waitFor()
  assert.match(await page.locator('header .company-logo img').getAttribute('src'), /^data:image\/(webp|png);base64,/)
  await page.reload()
  await page.locator('header').getByText('Север Лаб').waitFor()
  await page.getByRole('textbox', { name: 'Вопрос' }).fill('Как устроена очередь сообщений?')
  await page.getByRole('textbox', { name: 'Вопрос' }).press('Enter')
  await page.getByRole('article', { name: 'Ответ модели' }).waitFor()
  await page.getByRole('link', { name: 'Профиль', exact: true }).click()
  await profileTabs.getByRole('link', { name: 'Собеседования', exact: true }).click()
  await page.getByRole('link', { name: /Север Лаб.*К вопросам/ }).click()
  await page.getByRole('link', { name: /Как устроена очередь сообщений/ }).click()
  await page.getByRole('link', { name: 'Открыть исходный диалог' }).click()
  await page.getByRole('heading', { name: 'Исходный диалог' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Как устроена очередь сообщений?' }).waitFor()
  await page.getByRole('link', { name: 'Главная' }).click()

  await page.setViewportSize({ width: 420, height: 720 })
  await page.getByRole('heading', { name: /Услышьте вопрос/ }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const pageScroller = page.locator('main > .overflow-y-auto')
  const sidebarPosition = (await page.locator('aside').boundingBox()).x
  await page.mouse.move(200, 225)
  for (const deltaX of [600, -600]) {
    await page.mouse.wheel(deltaX, 0)
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    assert.equal(await page.evaluate(() => window.scrollX), 0)
    assert.equal(await pageScroller.evaluate((element) => element.scrollLeft), 0)
    assert.equal((await page.locator('aside').boundingBox()).x, sidebarPosition)
  }
  await page.mouse.wheel(0, 240)
  await page.waitForFunction(() => document.querySelector('main > .overflow-y-auto').scrollTop > 0)
  await pageScroller.evaluate((element) => element.scrollTo(0, 0))
  await screenshot(page, '14-home-narrow')
  await startInterview.click()
  assert.equal(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth), true)
  await picker.getByRole('button', { name: 'Север Лаб', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Edge: чат, выбор компании, наведение и reduced motion, загрузка и сохранение логотипа, компактное окно и остальные сценарии — OK.')
} finally {
  await browser?.close()
  await new Promise((done) => previewServer.httpServer.close(done))
}
