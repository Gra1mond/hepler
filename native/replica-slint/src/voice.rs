#[cfg(windows)]
mod platform {
    use std::io::{Read, Write};
    use std::os::windows::process::CommandExt;
    use std::process::{Child, ChildStdin, Command, Stdio};
    use std::sync::mpsc::{self, Receiver, TryRecvError};
    use std::thread;

    use base64::Engine;

    const CAPTURE_FAILED: &str =
        "Не удалось распознать речь. Проверьте доступ к микрофону и попробуйте ещё раз.";
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    // Read one byte from the parent when asked to stop. Closing the pipe without a
    // byte cancels the capture. Only the final recognition result goes to stdout.
    const CAPTURE_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$engine = $null
try {
    Add-Type -AssemblyName System.Speech
    $language = [System.Globalization.CultureInfo]::GetCultureInfo($env:REPLICA_VOICE_LOCALE)
    $available = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
    $recognizer = $available | Where-Object { $_.Culture.Name -eq $language.Name } | Select-Object -First 1
    if ($null -eq $recognizer) {
        $recognizer = $available | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq $language.TwoLetterISOLanguageName } | Select-Object -First 1
    }
    if ($null -eq $recognizer) {
        [Console]::WriteLine('missing')
        return
    }

    $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizer)
    $engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
    $engine.SetInputToDefaultAudioDevice()
    Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier voice-phrase | Out-Null
    Register-ObjectEvent -InputObject $engine -EventName RecognizeCompleted -SourceIdentifier voice-done | Out-Null

    $inputPipe = [Console]::OpenStandardInput()
    $control = [byte[]]::new(1)
    $read = $inputPipe.ReadAsync($control, 0, 1)
    $phrases = [System.Collections.Generic.List[string]]::new()
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    $finishBy = [DateTime]::MaxValue
    $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

    while ($true) {
        if ($read.IsCompleted -and $read.Result -eq 0) { return }
        $now = [DateTime]::UtcNow
        if ($finishBy -eq [DateTime]::MaxValue -and ($read.IsCompleted -or $now -ge $deadline)) {
            $engine.RecognizeAsyncStop()
            $finishBy = $now.AddSeconds(3)
        }
        $done = Get-Event -SourceIdentifier voice-done -ErrorAction SilentlyContinue | Select-Object -First 1
        Get-Event -SourceIdentifier voice-phrase -ErrorAction SilentlyContinue | ForEach-Object {
            $phrases.Add($_.SourceEventArgs.Result.Text)
            Remove-Event -EventIdentifier $_.EventIdentifier
        }
        if ($null -ne $done -or $now -ge $finishBy) {
            if ($null -ne $done -and $null -ne $done.SourceEventArgs.Error) {
                [Console]::WriteLine('failed')
            } elseif ($phrases.Count -eq 0) {
                [Console]::WriteLine('empty')
            } else {
                [Console]::WriteLine('ok')
                [Console]::WriteLine([string]::Join(' ', $phrases))
            }
            return
        }
        Start-Sleep -Milliseconds 80
    }
} catch {
    [Console]::WriteLine('failed')
} finally {
    if ($null -ne $engine) { $engine.Dispose() }
}
"#;

    pub struct VoiceCapture {
        child: Child,
        input: Option<ChildStdin>,
        result: Receiver<Result<String, String>>,
    }

    impl VoiceCapture {
        pub fn start(locale: &str) -> Result<Self, String> {
            let script: Vec<u8> = CAPTURE_SCRIPT
                .encode_utf16()
                .flat_map(u16::to_le_bytes)
                .collect();
            let encoded = base64::engine::general_purpose::STANDARD.encode(script);
            let executable = std::env::var_os("SystemRoot")
                .map(std::path::PathBuf::from)
                .ok_or_else(|| "Не удалось запустить распознавание речи Windows.".to_string())?
                .join("System32/WindowsPowerShell/v1.0/powershell.exe");
            let mut child = Command::new(executable)
                .args([
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-EncodedCommand",
                    &encoded,
                ])
                .env("REPLICA_VOICE_LOCALE", locale)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|_| "Не удалось запустить распознавание речи Windows.".to_string())?;
            let (sender, receiver) = mpsc::channel();
            let mut output = child.stdout.take().expect("voice stdout was piped");
            let reader = thread::Builder::new()
                .name("replica-voice-result".to_string())
                .spawn(move || {
                    let mut reply = String::new();
                    let result = output
                        .read_to_string(&mut reply)
                        .map_err(|_| CAPTURE_FAILED.to_string())
                        .and_then(|_| decode_capture(&reply));
                    let _ = sender.send(result);
                });
            if reader.is_err() {
                let _ = child.kill();
                let _ = child.wait();
                return Err(CAPTURE_FAILED.to_string());
            }
            Ok(Self {
                input: child.stdin.take(),
                child,
                result: receiver,
            })
        }

        pub fn stop(&mut self) -> Result<(), String> {
            if let Some(mut input) = self.input.take() {
                match input.write_all(&[1]) {
                    // An already finished session may have closed its input.
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::BrokenPipe => {}
                    Err(_) => return Err(CAPTURE_FAILED.to_string()),
                }
            }
            Ok(())
        }

        pub fn poll(&mut self) -> Option<Result<String, String>> {
            match self.result.try_recv() {
                Ok(result) => Some(result),
                Err(TryRecvError::Empty) => None,
                Err(TryRecvError::Disconnected) => Some(Err(CAPTURE_FAILED.to_string())),
            }
        }

        pub fn cancel(self) {}
    }

    impl Drop for VoiceCapture {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    fn decode_capture(reply: &str) -> Result<String, String> {
        let mut lines = reply.lines();
        match lines.next() {
            Some("ok") => {
                let text = lines.collect::<Vec<_>>().join("\n");
                if !text.trim().is_empty() {
                    return Ok(text.trim().to_string());
                }
                Err("Речь не распознана. Попробуйте записать ответ ещё раз.".into())
            }
            Some("empty") => Err("Речь не распознана. Попробуйте записать ответ ещё раз.".into()),
            Some("missing") => Err("Для этого языка в Windows не установлено распознавание речи. Ответ можно напечатать.".into()),
            _ => Err(CAPTURE_FAILED.to_string()),
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub struct VoiceCapture;

    impl VoiceCapture {
        pub fn start(_locale: &str) -> Result<Self, String> {
            Err("На этой платформе доступен текстовый ответ.".into())
        }

        pub fn stop(&mut self) -> Result<(), String> {
            Ok(())
        }

        pub fn poll(&mut self) -> Option<Result<String, String>> {
            None
        }

        pub fn cancel(self) {}
    }
}

pub use platform::VoiceCapture;
