#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod chat;
mod data;

use chat::{ChatState, RowStatus};
use chrono::{SecondsFormat, Utc};
use data::{
    Company, FORMATS, Interview, InterviewLog, MODELS, Material, Preferences, Question, Resume,
};
use slint::winit_030::WinitWindowAccessor;
use slint::{CloseRequestResponse, ComponentHandle, ModelRc, SharedString, Timer, VecModel};
use slint::{Model, language::ColorScheme};
use std::{cell::RefCell, path::PathBuf, rc::Rc, time::Duration};
use uuid::Uuid;

slint::include_modules!();

const NAVIGATION: [(&str, &str); 6] = [
    ("home", "Главная"),
    ("chat", "Собеседование"),
    ("materials", "Материалы"),
    ("settings", "Настройки агента"),
    ("records", "Записи"),
    ("profile", "Профиль"),
];

#[derive(Clone, Copy)]
enum ChatWindow {
    Main = 0,
    Compact = 1,
}

struct Runtime {
    main: MainWindow,
    compact: CompactWindow,
    registration: RegistrationWindow,
    prefs: RefCell<Preferences>,
    path: PathBuf,
    chats: [RefCell<ChatState>; 2],
    examples: Vec<Question>,
    pending_logo: RefCell<Option<String>>,
    fail_next: RefCell<bool>,
    icons: [slint::Image; 6],
}

fn list<T: Clone + 'static>(values: impl IntoIterator<Item = T>) -> ModelRc<T> {
    ModelRc::new(VecModel::from(values.into_iter().collect::<Vec<_>>()))
}

impl Runtime {
    fn new(path: PathBuf) -> Result<Rc<Self>, slint::PlatformError> {
        let main = MainWindow::new()?;
        let compact = CompactWindow::new()?;
        let registration = RegistrationWindow::new()?;
        compact
            .window()
            .set_size(slint::LogicalSize::new(460.0, 680.0));
        registration
            .window()
            .set_size(slint::LogicalSize::new(444.0, 472.0));
        let icons = std::array::from_fn(|index| {
            main.get_navigation_icons()
                .row_data(index)
                .unwrap_or_default()
        });
        Ok(Rc::new(Self {
            main,
            compact,
            registration,
            icons,
            prefs: RefCell::new(Preferences::load(&path)),
            path,
            chats: std::array::from_fn(|_| RefCell::default()),
            examples: data::examples(),
            pending_logo: RefCell::default(),
            fail_next: RefCell::default(),
        }))
    }

    fn chat(&self, which: ChatWindow) -> &RefCell<ChatState> {
        &self.chats[which as usize]
    }

    fn globals(&self) -> [DemoState<'_>; 2] {
        [
            self.main.global::<DemoState>(),
            self.compact.global::<DemoState>(),
        ]
    }

    fn update_preferences(&self, update: impl FnOnce(&mut Preferences)) {
        {
            let mut prefs = self.prefs.borrow_mut();
            update(&mut prefs);
            if let Err(error) = prefs.persist(&self.path) {
                eprintln!("Could not store Replica demo preferences: {error}");
            }
        }
        self.render_preferences();
    }

    fn render_preferences(&self) {
        let prefs = self.prefs.borrow();
        let companies = data::companies(&prefs.custom_companies);
        let company = prefs
            .interview
            .as_ref()
            .and_then(|session| session.company_id.as_ref())
            .and_then(|id| companies.iter().find(|company| &company.id == id));
        let logo = company.map(Company::image).unwrap_or_default();
        let materials = list(prefs.questions.iter().map(|item| MaterialQuestion {
            text: item.text.as_str().into(),
            topic: item.topic.as_str().into(),
        }));
        let model_index = MODELS
            .iter()
            .position(|(id, _)| *id == prefs.model)
            .unwrap_or_default();
        let options = list(MODELS.iter().map(|(id, label)| SelectOption {
            label: (*label).into(),
            value: (*id).into(),
            disabled: prefs.model != *id && !prefs.is_connected(id),
        }));
        let connected = list(
            prefs
                .connected
                .iter()
                .map(|value| SharedString::from(value.as_str())),
        );
        for ui in self.globals() {
            ui.set_ready(prefs.can_chat());
            ui.set_model_index(model_index as i32);
            ui.set_models(options.clone());
            ui.set_connected(connected.clone());
            ui.set_format(prefs.format.as_str().into());
            ui.set_company(company.map_or("", |value| &value.name).into());
            ui.set_company_logo(logo.clone());
            ui.set_resume_name(
                prefs
                    .resume
                    .as_ref()
                    .map_or("", |resume| &resume.name)
                    .into(),
            );
            ui.set_resume_has_text(
                prefs
                    .resume
                    .as_ref()
                    .is_some_and(|resume| !resume.text.trim().is_empty()),
            );
            ui.set_materials(materials.clone());
        }
        self.main.set_preferred_model(prefs.model.as_str().into());
        self.main.set_settings_format(prefs.format.as_str().into());
        self.main
            .set_companies(list(companies.iter().map(|company| CompanyRow {
                id: company.id.as_str().into(),
                name: company.name.as_str().into(),
                logo: company.image(),
            })));
        drop(prefs);
        self.render_interviews(self.main.get_page().as_str());
    }

    fn filter_navigation(&self, query: &str) {
        let query = query.trim().to_lowercase();
        self.main.set_navigation(list(
            NAVIGATION
                .iter()
                .enumerate()
                .filter(|(_, (_, title))| title.to_lowercase().contains(&query))
                .map(|(index, (route, title))| NavigationItem {
                    route: (*route).into(),
                    title: (*title).into(),
                    icon: self.icons[index].clone(),
                }),
        ));
    }

    fn navigate(&self, page: &str) {
        if page == "chat" {
            let prefs = self.prefs.borrow();
            if prefs.can_chat() && prefs.interview.is_none() {
                self.main.set_show_companies(true);
                return;
            }
        }
        self.show_page(page);
    }

    fn show_page(&self, page: &str) {
        let profile = match page {
            "profile" | "profile/materials" => page,
            value if value.starts_with("profile/interviews") => "profile/interviews",
            value if value.starts_with("usage") => "usage",
            _ => "",
        };
        self.main.set_title_label(
            NAVIGATION
                .iter()
                .find(|(route, _)| *route == page)
                .map_or("Профиль", |(_, title)| *title)
                .into(),
        );
        self.main.set_profile_tab(profile.into());
        self.main.set_show_connection(false);
        self.main.set_material_issue("".into());
        self.main.set_settings_notice("".into());
        self.main.set_page(page.into());
        self.main.invoke_reset_scroll();
        if profile == "profile/interviews" {
            self.render_interviews(page);
        }
    }

    fn render_interviews(&self, page: &str) {
        let prefs = self.prefs.borrow();
        let companies = data::companies(&prefs.custom_companies);
        let library = prefs.library(&self.examples);
        let question_card = |q: &Question| InterviewQuestionCard {
            id: q.id.as_str().into(),
            title: q.title.as_str().into(),
            topic: q.topic.as_str().into(),
            level: q.level.as_str().into(),
            date: data::format_date(&q.at).into(),
            description: q.description.as_str().into(),
            summary: q.answer.summary.as_str().into(),
            explanation: q.answer.explanation.as_str().into(),
            example: q.answer.example.as_str().into(),
            company_id: q.company_id.as_str().into(),
            company_name: companies
                .iter()
                .find(|c| c.id == q.company_id)
                .map_or("", |c| &c.name)
                .into(),
            demo: q.demo,
        };
        let mut total_dialogues = 0;
        let mut active_companies = 0;
        let cards: Vec<_> = companies
            .iter()
            .map(|company| {
                let sessions: Vec<_> = prefs
                    .interviews
                    .iter()
                    .filter(|entry| entry.company_id == company.id)
                    .collect();
                let demo_dates: std::collections::BTreeSet<_> = self
                    .examples
                    .iter()
                    .filter(|q| q.company_id == company.id)
                    .map(|q| &q.at)
                    .collect();
                let last = sessions
                    .iter()
                    .map(|session| &session.started_at)
                    .chain(demo_dates.iter().copied())
                    .max();
                let questions = library
                    .iter()
                    .filter(|q| q.company_id == company.id)
                    .count();
                let count = sessions.len() + demo_dates.len();
                total_dialogues += count;
                active_companies += usize::from(count > 0);
                InterviewCompanyCard {
                    id: company.id.as_str().into(),
                    name: company.name.as_str().into(),
                    initials: data::company_initials(&company.name).into(),
                    last_label: last
                        .map_or_else(String::new, |date| {
                            format!("Последний диалог · {}", data::format_date(date))
                        })
                        .into(),
                    dialogue_label: plural(count, ["диалог", "диалога", "диалогов"]).into(),
                    question_label: plural(questions, ["вопрос", "вопроса", "вопросов"]).into(),
                    logo: company.image(),
                }
            })
            .collect();
        let route = page.strip_prefix("profile/interviews").unwrap_or("");
        let (kind, id) = route
            .trim_start_matches('/')
            .split_once('/')
            .unwrap_or_else(|| {
                if route == "/questions" {
                    ("library", "")
                } else {
                    ("overview", "")
                }
            });
        self.main.set_interview_kind(kind.into());
        self.main.set_interview_companies(list(
            cards.iter().filter(|c| !c.last_label.is_empty()).cloned(),
        ));
        self.main.set_interview_questions(list(
            library
                .iter()
                .filter(|q| kind != "company" || q.company_id == id)
                .map(question_card),
        ));
        let selected = library
            .iter()
            .chain(prefs.interviews.iter().flat_map(|log| &log.questions))
            .find(|q| q.id == id);
        let company_id = selected.map_or(id, |q| &q.company_id);
        self.main.set_selected_company(
            cards
                .into_iter()
                .find(|c| c.id == company_id)
                .unwrap_or_default(),
        );
        self.main
            .set_active_question(selected.map(question_card).unwrap_or_default());
        let dialogue = prefs
            .interviews
            .iter()
            .find(|log| log.questions.iter().any(|q| q.id == id))
            .map_or_else(
                || selected.map_or(&[][..], std::slice::from_ref),
                |log| log.questions.as_slice(),
            );
        self.main
            .set_dialogue(list(dialogue.iter().map(question_card)));
        self.main.set_interview_summary(
            format!(
                "{} · {} · {}",
                plural(active_companies, ["компания", "компании", "компаний"]),
                plural(total_dialogues, ["диалог", "диалога", "диалогов"]),
                plural(library.len(), ["вопрос", "вопроса", "вопросов"])
            )
            .into(),
        );
    }

    fn start_picker(&self) {
        if !self.prefs.borrow().can_chat() {
            self.show_page("settings");
            self.main.set_show_connection(true);
        } else {
            self.main.set_show_companies(true);
        }
    }

    fn new_interview(&self, selected: Option<Company>, id: Option<String>) {
        let session = Interview {
            id: Uuid::new_v4().to_string(),
            company_id: id,
        };
        self.update_preferences(|prefs| {
            if let Some(company) = selected {
                prefs.custom_companies.push(company);
            }
            if let Some(company_id) = &session.company_id {
                prefs.interviews.push(InterviewLog {
                    id: session.id.clone(),
                    company_id: company_id.clone(),
                    started_at: timestamp(),
                    questions: Vec::new(),
                });
            }
            prefs.interview = Some(session);
        });
        for which in [ChatWindow::Main, ChatWindow::Compact] {
            self.chat(which).borrow_mut().reset();
            self.render_chat(which);
        }
        self.clear_logo();
        self.main.set_show_companies(false);
        self.show_page("chat");
    }

    fn select_model(&self, model: &str) {
        if let Some((id, _)) = MODELS
            .iter()
            .find(|(id, label)| model == *id || model == *label)
        {
            self.update_preferences(|p| p.model = (*id).into());
        }
    }

    fn connect(&self, model: &str) {
        if let Some((id, _)) = MODELS
            .iter()
            .find(|(id, label)| model == *id || model == *label)
        {
            self.update_preferences(|prefs| {
                prefs.model = (*id).into();
                if !prefs.connected.contains(&prefs.model) {
                    prefs.connected.push(prefs.model.clone());
                }
            });
            self.main.set_show_connection(false);
            self.main
                .set_settings_notice("Подключение добавлено".into());
        }
    }

    fn render_chat(&self, which: ChatWindow) {
        let chat = self.chat(which).borrow();
        let rows = list(chat.rows.iter().map(|row| {
            let mut out = ChatRow {
                id: row.id,
                question: row.question.as_str().into(),
                ..Default::default()
            };
            out.status = match &row.status {
                RowStatus::Pending => "pending",
                RowStatus::Error => "error",
                RowStatus::Complete(answer) => {
                    out.summary = answer.summary.as_str().into();
                    out.explanation = answer.explanation.as_str().into();
                    out.example = answer.example.as_str().into();
                    "complete"
                }
            }
            .into();
            out
        }));
        let pending = chat.active_id().is_some();
        let usage = format!(
            "{} · 0,00 $",
            plural(chat.completed_count(), ["запрос", "запроса", "запросов"])
        );
        macro_rules! update {
            ($ui:expr) => {{
                if $ui.get_draft().as_str() != chat.draft {
                    $ui.set_draft(chat.draft.as_str().into());
                }
                $ui.set_pending(pending);
                $ui.set_rows(rows);
                $ui.set_session_usage(usage.into());
            }};
        }
        match which {
            ChatWindow::Main => update!(self.main.global::<ChatViewState>()),
            ChatWindow::Compact => update!(self.compact.global::<ChatViewState>()),
        }
        match which {
            ChatWindow::Main => self.main.invoke_reveal_latest(),
            ChatWindow::Compact => self.compact.invoke_reveal_latest(),
        }
    }

    fn queue_reply(self: &Rc<Self>, which: ChatWindow, attempt: i32, session: Option<Interview>) {
        self.render_chat(which);
        let weak = Rc::downgrade(self);
        Timer::single_shot(Duration::from_millis(1000), move || {
            let Some(runtime) = weak.upgrade() else {
                return;
            };
            let completed = {
                let mut chat = runtime.chat(which).borrow_mut();
                let row_id = chat.active_row_id();
                if !chat.finish(attempt) {
                    return;
                }
                chat.rows.iter().find_map(|row| match &row.status {
                    RowStatus::Complete(answer) if Some(row.id) == row_id => Some((
                        row.question.clone(),
                        data::Answer {
                            summary: answer.summary.clone(),
                            explanation: answer.explanation.clone(),
                            example: answer.example.clone(),
                        },
                    )),
                    _ => None,
                })
            };
            runtime.render_chat(which);
            if let (Some(session), Some((title, answer))) = (session, completed) {
                runtime.update_preferences(|prefs| {
                    let key = data::normalize(&title);
                    let topic = prefs
                        .questions
                        .iter()
                        .find(|question| data::normalize(&question.text) == key)
                        .map(|question| question.topic.clone())
                        .unwrap_or_default();
                    if let Some(log) = prefs.interviews.iter_mut().find(|log| log.id == session.id)
                    {
                        log.questions.push(Question {
                            id: Uuid::new_v4().to_string(),
                            company_id: log.company_id.clone(),
                            title,
                            topic,
                            at: timestamp(),
                            answer,
                            level: String::new(),
                            description: String::new(),
                            demo: false,
                        });
                    }
                });
            }
        });
    }

    fn submit(self: &Rc<Self>, which: ChatWindow, retry: Option<i32>) {
        let prefs = self.prefs.borrow();
        if !prefs.can_chat() {
            return;
        }
        let session = prefs.interview.clone();
        let active_ui = match which {
            ChatWindow::Main => &self.main.global::<DemoState>(),
            ChatWindow::Compact => &self.compact.global::<DemoState>(),
        };
        let mut chat = self.chat(which).borrow_mut();
        if chat.active_id().is_some() || (retry.is_none() && chat.draft.trim().is_empty()) {
            return;
        }
        if matches!(which, ChatWindow::Main) && self.fail_next.replace(false) {
            chat.fail_next();
        }
        let materials = if active_ui.get_include_resume() {
            prefs
                .resume
                .as_ref()
                .filter(|r| !r.text.is_empty())
                .map(|r| r.text.clone())
        } else {
            None
        };
        let materials = materials.or_else(|| {
            if active_ui.get_include_questions() {
                prefs.questions.first().map(|q| q.text.clone())
            } else {
                None
            }
        });
        chat.set_request_context(&prefs.format, materials);
        let attempt = match retry {
            Some(id) => chat.retry(id),
            None => chat.submit(),
        };
        drop(chat);
        drop(prefs);
        if let Some(attempt) = attempt {
            self.queue_reply(which, attempt, session);
        }
    }

    fn stop(&self, which: ChatWindow) {
        let stopped = self.chat(which).borrow_mut().stop();
        if stopped {
            self.render_chat(which);
        }
    }

    fn copy(self: &Rc<Self>, which: ChatWindow, id: i32) {
        let chat = self.chat(which).borrow();
        let Some(answer) = chat.rows.iter().find_map(|row| match &row.status {
            RowStatus::Complete(answer) if row.id == id => Some(answer),
            _ => None,
        }) else {
            return;
        };
        let copied = arboard::Clipboard::new()
            .and_then(|mut clipboard| clipboard.set_text(answer.copy_text()))
            .is_ok();
        self.set_copy_notice(
            which,
            if copied {
                "Скопировано"
            } else {
                "Не удалось скопировать"
            },
        );
    }

    fn set_copy_notice(&self, which: ChatWindow, message: &str) {
        match which {
            ChatWindow::Main => self
                .main
                .global::<ChatViewState>()
                .set_notice(message.into()),
            ChatWindow::Compact => self
                .compact
                .global::<ChatViewState>()
                .set_notice(message.into()),
        }
    }

    fn clear_logo(&self) {
        self.pending_logo.replace(None);
        self.main.set_logo_preview(slint::Image::default());
        self.main.set_logo_filename("".into());
        self.main.set_logo_error("".into());
    }

    fn choose_logo(&self) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("Изображения", &["png", "jpg", "jpeg", "webp"])
            .pick_file()
        {
            self.clear_logo();
            match data::read_logo(&path) {
                Ok((encoded, image)) => {
                    self.pending_logo.replace(Some(encoded));
                    self.main.set_logo_preview(image);
                    self.main.set_logo_filename(data::filename(&path).into());
                }
                Err(error) => self.main.set_logo_error(error.into()),
            }
        }
    }

    fn upload_resume(&self) {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Резюме", &["txt", "pdf"])
            .pick_file()
        else {
            return;
        };
        let ext = path.extension().unwrap_or_default().to_ascii_lowercase();
        if ext != "txt" && ext != "pdf" {
            self.main
                .set_material_issue("Выберите файл в формате TXT или PDF.".into());
            return;
        }
        match data::read_limited(&path, 1024 * 1024, "Выберите файл размером до 1 МБ.")
        {
            Ok(bytes) => {
                let text = if ext == "txt" {
                    String::from_utf8_lossy(&bytes)
                        .chars()
                        .take(12_000)
                        .collect()
                } else {
                    String::new()
                };
                self.main.set_material_issue("".into());
                self.update_preferences(|prefs| {
                    prefs.resume = Some(Resume {
                        name: data::filename(&path),
                        text,
                    })
                });
            }
            Err(error) => self.main.set_material_issue(error.into()),
        }
    }

    fn import_questions(&self) {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Текст", &["txt"])
            .pick_file()
        else {
            return;
        };
        if path.extension().unwrap_or_default().to_ascii_lowercase() != "txt" {
            self.main
                .set_material_issue("Для списка вопросов выберите TXT.".into());
            return;
        }
        match data::read_limited(&path, 1024 * 1024, "Выберите файл размером до 1 МБ.")
        {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                let items: Vec<_> = text
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .take(100)
                    .map(|line| Material {
                        text: line.chars().take(500).collect(),
                        topic: String::new(),
                    })
                    .collect();
                if items.is_empty() {
                    self.main.set_material_issue(
                        "Добавьте по одному вопросу на строку в текстовом файле.".into(),
                    );
                } else {
                    self.main.set_material_issue("".into());
                    self.update_preferences(|prefs| prefs.questions.extend(items));
                }
            }
            Err(error) => self.main.set_material_issue(error.into()),
        }
    }
}

fn plural(count: usize, words: [&str; 3]) -> String {
    let form = if (11..=14).contains(&(count % 100)) {
        2
    } else {
        match count % 10 {
            1 => 0,
            2..=4 => 1,
            _ => 2,
        }
    };
    format!("{count} {}", words[form])
}

fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn focus(window: &slint::Window) {
    window.with_winit_window(|native| native.focus_window());
}

fn validate_registration(name: &str, email: &str, password: &str) -> Result<(), &'static str> {
    if name.trim().is_empty() || name.chars().count() > 80 {
        return Err("Укажите имя.");
    }
    let valid_email = email.len() <= 254
        && !email.contains(char::is_whitespace)
        && email.split_once('@').is_some_and(|(user, domain)| {
            !user.is_empty() && !domain.is_empty() && !domain.contains('@')
        });
    if !valid_email {
        return Err("Укажите электронную почту.");
    }
    if !(8..=128).contains(&password.chars().count()) {
        return Err("Введите пароль от 8 до 128 символов.");
    }
    Ok(())
}

fn main() -> Result<(), slint::PlatformError> {
    let path = std::env::var_os("REPLICA_DEMO_DATA")
        .map(PathBuf::from)
        .unwrap_or_else(data::preferences_path);
    let runtime = Runtime::new(path)?;
    runtime
        .main
        .global::<Palette>()
        .set_color_scheme(ColorScheme::Dark);
    runtime
        .compact
        .global::<Palette>()
        .set_color_scheme(ColorScheme::Dark);
    wire(&runtime);
    runtime.filter_navigation("");
    runtime.render_preferences();
    runtime.render_chat(ChatWindow::Main);
    runtime.render_chat(ChatWindow::Compact);
    let reduce = std::env::args().any(|arg| arg == "--reduced-motion") || reduced_motion();
    for ui in runtime.globals() {
        ui.set_reduced_motion(reduce);
    }
    runtime.main.run()
}

#[cfg(windows)]
fn reduced_motion() -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SPI_GETCLIENTAREAANIMATION, SystemParametersInfoW,
    };
    let mut enabled = 1_i32;
    unsafe {
        SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            (&mut enabled as *mut i32).cast(),
            0,
        ) != 0
            && enabled == 0
    }
}

#[cfg(not(windows))]
fn reduced_motion() -> bool {
    false
}

fn wire(runtime: &Rc<Runtime>) {
    for ui in [
        runtime.main.global::<UiText>(),
        runtime.compact.global::<UiText>(),
    ] {
        ui.on_trim(|value| value.trim().into());
        ui.on_initials(|value| data::company_initials(&value).into());
    }
    macro_rules! bind {
        ($ui:expr, $event:ident, |$app:ident $(, $arg:ident)*| $body:expr) => {{
            let weak = Rc::downgrade(runtime);
            $ui.$event(move |$($arg),*| {
                if let Some($app) = weak.upgrade() { $body; }
            });
        }};
    }
    macro_rules! bind_chat {
        ($ui:expr, $which:expr) => {
            bind!($ui, on_draft_changed, |app, draft| app
                .chat($which)
                .borrow_mut()
                .draft =
                draft.to_string());
            bind!($ui, on_submit, |app| app.submit($which, None));
            bind!($ui, on_stop, |app| app.stop($which));
            bind!($ui, on_retry, |app, id| app.submit($which, Some(id)));
            bind!($ui, on_copy_answer, |app, id| app.copy($which, id));
        };
    }
    bind_chat!(runtime.main.global::<ChatViewState>(), ChatWindow::Main);
    bind_chat!(
        runtime.compact.global::<ChatViewState>(),
        ChatWindow::Compact
    );
    let main_state = runtime.main.global::<DemoState>();
    let compact_state = runtime.compact.global::<DemoState>();
    for ui in [&main_state, &compact_state] {
        bind!(ui, on_select_model, |app, input| app.select_model(&input));
        bind!(ui, on_select_format, |app, input| {
            if FORMATS.contains(&input.as_str()) {
                app.update_preferences(|prefs| prefs.format = input.to_string());
            }
        });
        bind!(ui, on_toggle_resume, |app, enabled| {
            for state in app.globals() {
                state.set_include_resume(enabled);
            }
        });
        bind!(ui, on_toggle_questions, |app, enabled| {
            for state in app.globals() {
                state.set_include_questions(enabled);
            }
        });
    }
    bind!(main_state, on_open_materials, |app| app
        .show_page("materials"));
    bind!(compact_state, on_open_materials, |app| {
        app.show_page("materials");
        let _ = app.main.show();
        focus(app.main.window());
    });
    bind!(main_state, on_open_settings, |app| {
        app.show_page("settings");
        app.main.set_show_connection(!app.prefs.borrow().can_chat());
    });
    bind!(compact_state, on_open_settings, |app| {
        app.show_page("settings");
        let _ = app.main.show();
        focus(app.main.window());
    });
    bind!(runtime.main, on_navigate, |app, page| app.navigate(&page));
    bind!(runtime.main, on_search, |app, query| app
        .filter_navigation(&query));
    bind!(runtime.main, on_begin_interview, |app| app.start_picker());
    bind!(runtime.main, on_connect, |app, model| app.connect(&model));
    bind!(runtime.main, on_demo_error, |app| {
        app.fail_next.replace(true);
    });
    bind!(runtime.main, on_close_connection, |app| app
        .main
        .set_show_connection(false));
    bind!(runtime.main, on_select_company, |app, id| app
        .new_interview(None, (!id.is_empty()).then(|| id.to_string())));
    bind!(runtime.main, on_dismiss_company, |app| {
        app.clear_logo();
        app.main.set_show_companies(false);
    });
    let weak = Rc::downgrade(runtime);
    runtime.main.on_existing_company(move |name| {
        weak.upgrade()
            .and_then(|app| data::matching_company(&name, &app.prefs.borrow().custom_companies))
            .unwrap_or_default()
            .into()
    });
    bind!(runtime.main, on_reset_logo_error, |app| app
        .main
        .set_logo_error("".into()));
    bind!(runtime.main, on_add_company, |app, name| {
        let name: String = name.trim().chars().take(80).collect();
        if !name.is_empty() {
            let id = format!("custom-{}", Uuid::new_v4());
            let company = Company {
                id: id.clone(),
                name,
                logo: app.pending_logo.take(),
            };
            app.new_interview(Some(company), Some(id));
        }
    });
    bind!(runtime.main, on_choose_logo, |app| app.choose_logo());
    bind!(runtime.main, on_clear_logo, |app| app.clear_logo());
    bind!(runtime.main, on_upload_resume, |app| app.upload_resume());
    bind!(runtime.main, on_remove_resume, |app| app
        .update_preferences(|p| p.resume = None));
    bind!(runtime.main, on_import_questions, |app| app
        .import_questions());
    bind!(runtime.main, on_save_question, |app, index, text, topic| {
        let text: String = text.trim().chars().take(500).collect();
        let topic: String = topic.trim().chars().take(80).collect();
        if !text.is_empty() {
            app.update_preferences(|prefs| {
                let item = Material { text, topic };
                if index < 0 {
                    prefs.questions.push(item);
                } else if let Some(old) = prefs.questions.get_mut(index as usize) {
                    *old = item;
                }
            });
        }
    });
    bind!(runtime.main, on_delete_question, |app, index| {
        app.update_preferences(|prefs| {
            if (index as usize) < prefs.questions.len() {
                prefs.questions.remove(index as usize);
            }
        });
    });

    bind!(
        runtime.main.global::<ChatViewState>(),
        on_change_window,
        |app| {
            if app.compact.show().is_ok() {
                focus(app.compact.window());
            }
        }
    );
    bind!(
        runtime.compact.global::<ChatViewState>(),
        on_change_window,
        |app| {
            app.show_page("chat");
            if app.main.show().is_ok() {
                focus(app.main.window());
            }
        }
    );
    bind!(runtime.main, on_register, |app| {
        if app.registration.show().is_ok() {
            focus(app.registration.window());
            app.registration.invoke_prepare_form();
        }
    });
    bind!(runtime.registration, on_dismiss, |app| {
        let _ = app.registration.hide();
        app.registration.set_account_name("".into());
        app.registration.set_email("".into());
        app.registration.set_password("".into());
        app.registration.set_status("".into());
        focus(app.main.window());
    });
    bind!(runtime.registration, on_drag_requested, |app| {
        app.registration.window().with_winit_window(|native| {
            let _ = native.drag_window();
        });
    });
    bind!(runtime.registration, on_submit, |app| {
        let form = &app.registration;
        let result = validate_registration(
            &form.get_account_name(),
            &form.get_email(),
            &form.get_password(),
        );
        form.set_invalid(result.is_err());
        form.set_status(
            result
                .err()
                .unwrap_or("Данные формы прошли проверку.")
                .into(),
        );
        if result.is_ok() {
            form.set_account_name("".into());
            form.set_email("".into());
            form.set_password("".into());
        }
        form.invoke_reveal_feedback();
    });
    let weak = Rc::downgrade(runtime);
    runtime.main.window().on_close_requested(move || {
        if let Some(app) = weak.upgrade() {
            let _ = app.compact.hide();
            let _ = app.registration.hide();
        }
        CloseRequestResponse::HideWindow
    });
    let weak = Rc::downgrade(runtime);
    runtime.registration.window().on_close_requested(move || {
        if let Some(app) = weak.upgrade() {
            app.registration.invoke_dismiss();
        }
        CloseRequestResponse::KeepWindowShown
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registration_preserves_demo_account_validation() {
        assert!(validate_registration("Анна", "anna@example.com", "демопароль").is_ok());
        assert!(validate_registration("Анна", "not an email", "демопароль").is_err());
        assert!(validate_registration("Анна", "anna@example.com", "1").is_err());
        assert!(validate_registration("", "anna@example.com", "демопароль").is_err());
    }
}
