# Реплика

Нативное приложение для Windows на Rust и Slint. В этой ветке находятся исходники приложения, макеты интерфейса Slint и ресурсы, которые использует сборка.

## Запуск

Откройте Developer PowerShell for Visual Studio с установленными Build Tools и Windows SDK. Из корня репозитория выполните:

```powershell
cargo run --locked --manifest-path native/replica-slint/Cargo.toml
cargo test --locked --manifest-path native/replica-slint/Cargo.toml
cargo build --locked --release --manifest-path native/replica-slint/Cargo.toml
```

В этой версии чат, регистрация и вход работают в деморежиме. Вход проверяет форму локально. Аватары Clover, Flower и Ghost используют изображения из макетов Реплики по мотивам [Bot Avatars](https://libraries.dev/bots). Движение реализовано в Slint.

[![Made with Slint](https://raw.githubusercontent.com/slint-ui/slint/master/logo/MadeWithSlint-logo-whitebg.png)](https://slint.dev/)
