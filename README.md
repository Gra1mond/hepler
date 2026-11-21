# Реплика

**v0.1.0 · Только фронтенд**

Десктопный прототип для Windows, который помогает разбирать вопросы с технических собеседований и собирать материалы для подготовки. Интерфейс написан на React и TypeScript, оформлен на Tailwind CSS и работает в оболочке Tauri 2.

## Что можно попробовать

- Выбрать модель и компанию перед началом диалога. Для своей компании можно загрузить логотип или использовать инициалы.
- Ввести вопрос и получить демонстрационный ответ с тезисом, объяснением и примером. Обычный и компактный чат показывают ожидание, ошибку и повторную отправку.
- Подготовить материалы в отдельной вкладке профиля. Она содержит резюме и список вопросов для контекста.
- Открыть карточку компании, перейти к её вопросам или посмотреть общую базу. Завершённые ответы сохраняются локально вместе с указанием исходного диалога.
- Посмотреть демонстрационную статистику использования API и экран отдельного окна регистрации.

В этой версии ответы и подключение к моделям имитирует локальный адаптер. Регистрация проверяет форму в интерфейсе. Компании, материалы и история вопросов хранятся на устройстве. Записи экрана и диалога представлены экраном-заглушкой.

## Запуск из исходников

Установите Node.js и pnpm. Для десктопного режима на Windows понадобятся Rust с инструментами MSVC и WebView2 Runtime. [Требования Tauri для Windows](https://v2.tauri.app/start/prerequisites/)

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite выведет адрес стенда. Для запуска отдельного окна приложения выполните `pnpm tauri dev`.

В приложении откройте **«Подключить модель» → «Демо-ключ» → «Добавить»**. Затем вернитесь на главную и нажмите **«Начать собеседование»**.

`pnpm build` проверяет TypeScript и собирает фронтенд. `pnpm test` запускает тесты Vitest. После сборки команда `pnpm test:browser` проверяет сценарии в установленном Microsoft Edge.

## Макеты Pixso

| Экран | Референс |
| --- | --- |
| Главная | [Обзор и выбор модели](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=6%3A1005) |
| Выбор компании | [Список компаний](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=75%3A1027) · [Загрузка своего логотипа](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=84%3A2758) |
| Чат | [Ответ в основном окне](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=6%3A2) · [Компактное окно](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=6%3A629) |
| Профиль | [Данные аккаунта](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=22%3A7232) · [Карточки компаний](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=75%3A3180) |
| База вопросов | [Общий список](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=82%3A1378) · [Карточка вопроса](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=82%3A1696) |
| Материалы и статистика | [Материалы](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=75%3A3702) · [Использование API](https://pixso.net/app/design/0_c9ZYcq-dthVPiMpUT5Og?page-id=6%3A1&item-id=22%3A1494) |

## Визуальные ориентиры

- Cursor и ChatGPT вдохновили тёмную палитру и компоновку чата. [Cursor в Mobbin](https://mobbin.com/apps/cursor-ios-d9c35530-fad1-488d-9c05-4f3c86894415/6075b360-1df2-59a6-b33f-57a77a3b935a/screens) · [ChatGPT в Mobbin](https://mobbin.com/apps/chat-gpt-ios-a96b7f4c-6bfa-4c9d-a6b7-562160feb391/7db88e58-d2ff-45e2-979c-e530e65c3015/screens)
- Подсказки клавиш, лента моделей и форма регистрации опираются на следующие референсы. [Spell Kbd](https://spell.sh/docs/kbd) · [Spell Marquee](https://spell.sh/docs/marquee) · [Форма MBerkayHamurcu на Uiverse](https://uiverse.io/MBerkayHamurcu/slimy-quail-55)
