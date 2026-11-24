# Реплика на Slint

Нативный интерфейс «Реплики» для Windows. Подключение моделей, ответы чата и регистрация работают в деморежиме. Настройки, материалы и история сохраняются локально.

## Сборка на Windows

Нужны Rust с целевой платформой x86_64-pc-windows-msvc и инструменты сборки Visual Studio с Windows SDK. Из корня репозитория выполните:

```powershell
cargo build --locked --release --manifest-path native/replica-slint/Cargo.toml
cargo test --locked --manifest-path native/replica-slint/Cargo.toml
```

Готовая сборка доступна на [странице релиза](https://github.com/Gra1mond/hepler/releases/tag/v0.1.0-slint).

[![Made with Slint](https://raw.githubusercontent.com/slint-ui/slint/master/logo/MadeWithSlint-logo-whitebg.png)](https://slint.dev/)
