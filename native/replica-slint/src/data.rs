use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use slint::{Image, Rgba8Pixel, SharedPixelBuffer};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub const MODELS: [(&str, &str); 4] = [
    ("gpt", "GPT · OpenAI"),
    ("claude", "Claude · Anthropic"),
    ("gemini", "Gemini · Google"),
    ("mistral", "Mistral · Mistral AI"),
];
pub const FORMATS: [&str; 3] = ["Краткий", "Структурированный", "Развёрнутый"];

#[derive(Clone, Deserialize, Serialize)]
pub struct Material {
    pub text: String,
    pub topic: String,
}
#[derive(Deserialize, Serialize)]
pub struct Resume {
    pub name: String,
    pub text: String,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Company {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
}

const BUILT_IN: [(&str, &str, &[u8]); 6] = [
    (
        "yandex",
        "Яндекс",
        include_bytes!("../ui/assets/companies/yandex.png"),
    ),
    (
        "ozon",
        "Ozon",
        include_bytes!("../ui/assets/companies/ozon.png"),
    ),
    (
        "avito",
        "Авито",
        include_bytes!("../ui/assets/companies/avito.png"),
    ),
    (
        "vk",
        "VK",
        include_bytes!("../ui/assets/companies/vk.png"),
    ),
    (
        "tbank",
        "Т-Банк",
        include_bytes!("../ui/assets/companies/tbank.png"),
    ),
    (
        "sber",
        "Сбер",
        include_bytes!("../ui/assets/companies/sber.png"),
    ),
];

pub fn companies(custom: &[Company]) -> Vec<Company> {
    BUILT_IN
        .iter()
        .map(|(id, name, _)| Company {
            id: id.to_string(),
            name: name.to_string(),
            logo: None,
        })
        .chain(custom.iter().cloned())
        .collect()
}

pub fn matching_company(name: &str, custom: &[Company]) -> Option<String> {
    let name = name.trim().to_lowercase();
    companies(custom)
        .into_iter()
        .find(|company| company.name.to_lowercase() == name)
        .map(|company| company.id)
}

pub fn company_initials(name: &str) -> String {
    name.split_whitespace()
        .take(2)
        .filter_map(|word| word.chars().next())
        .flat_map(char::to_uppercase)
        .collect()
}

impl Company {
    pub fn image(&self) -> Image {
        let file = BUILT_IN
            .iter()
            .find(|(id, _, _)| *id == self.id)
            .map(|(_, _, bytes)| *bytes);
        if let Some(bytes) = file {
            return decode_image(bytes);
        }
        self.logo
            .as_ref()
            .and_then(|value| value.split_once(","))
            .and_then(|(_, value)| STANDARD.decode(value).ok())
            .map(|image| decode_image(&image))
            .unwrap_or_default()
    }
}

fn decode_image(data: &[u8]) -> Image {
    image::load_from_memory(data)
        .ok()
        .map(|image| {
            let rgba = image.into_rgba8();
            Image::from_rgba8(SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(
                &rgba,
                rgba.width(),
                rgba.height(),
            ))
        })
        .unwrap_or_default()
}

pub fn read_logo(path: &Path) -> Result<(String, Image), &'static str> {
    let bytes = read_limited(path, 5 * 1024 * 1024, "Выберите файл размером до 5 МБ.")?;
    match image::guess_format(&bytes) {
        Ok(image::ImageFormat::Png | image::ImageFormat::Jpeg | image::ImageFormat::WebP) => {}
        _ => return Err("Выберите изображение в формате PNG, JPG или WebP."),
    }
    let invalid = "Не удалось открыть изображение. Выберите другой файл.";
    let original = image::load_from_memory(&bytes).map_err(|_| invalid)?;
    let scaled = if original.width() > 96 || original.height() > 96 {
        original.thumbnail(96, 96)
    } else {
        original
    };
    let mut png = io::Cursor::new(Vec::new());
    scaled
        .write_to(&mut png, image::ImageFormat::Png)
        .map_err(|_| invalid)?;
    let bytes = png.into_inner();
    Ok((
        format!("data:image/png;base64,{}", STANDARD.encode(&bytes)),
        decode_image(&bytes),
    ))
}

pub fn read_limited(path: &Path, max: u64, message: &'static str) -> Result<Vec<u8>, &'static str> {
    use io::Read;
    let file = fs::File::open(path).map_err(|_| "Не удалось открыть файл.")?;
    let mut bytes = Vec::new();
    file.take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Не удалось прочитать файл.")?;
    if bytes.len() as u64 > max {
        return Err(message);
    }
    Ok(bytes)
}

pub fn filename(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

#[derive(Clone, Default, Deserialize, Serialize)]
pub struct Answer {
    pub summary: String,
    #[serde(default)]
    pub explanation: String,
    #[serde(default)]
    pub example: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: String,
    pub company_id: String,
    pub title: String,
    pub topic: String,
    pub at: String,
    pub answer: Answer,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub demo: bool,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewLog {
    pub id: String,
    pub company_id: String,
    pub started_at: String,
    pub questions: Vec<Question>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Interview {
    pub id: String,
    pub company_id: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
    pub model: String,
    pub connected: Vec<String>,
    pub format: String,
    pub resume: Option<Resume>,
    pub questions: Vec<Material>,
    pub custom_companies: Vec<Company>,
    pub interviews: Vec<InterviewLog>,
    pub interview: Option<Interview>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            model: "gpt".into(),
            connected: Vec::new(),
            format: FORMATS[1].into(),
            resume: Some(Resume {
                name: "resume_demo.pdf".into(),
                text: "Демо-резюме. Проектировал базы данных, анализировал запросы и работал над улучшением времени отклика.".into(),
            }),
            questions: [
                ("Когда индекс может замедлить базу данных?", "Базы данных"),
                ("Как вы диагностируете медленный запрос?", "Базы данных"),
                ("Расскажите о сложном решении в вашем последнем проекте.", "Опыт"),
            ].into_iter().map(|(text, topic)| Material { text: text.into(), topic: topic.into() }).collect(),
            custom_companies: Vec::new(),
            interviews: Vec::new(),
            interview: None,
        }
    }
}

impl Preferences {
    pub fn load(path: &Path) -> Self {
        let mut prefs: Self = fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        if !MODELS.iter().any(|(id, _)| *id == prefs.model) {
            prefs.model = MODELS[0].0.into();
        }
        prefs
            .connected
            .retain(|id| MODELS.iter().any(|(model, _)| model == id));
        if !FORMATS.contains(&prefs.format.as_str()) {
            prefs.format = FORMATS[1].into();
        }
        prefs
    }
    pub fn persist(&self, path: &Path) -> io::Result<()> {
        use io::Write;
        fs::create_dir_all(path.parent().expect("preferences path has parent"))?;
        let temp = path.with_extension("tmp");
        let mut file = fs::File::create(&temp)?;
        serde_json::to_writer(&mut file, self)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        fs::rename(temp, path)
    }

    pub fn can_chat(&self) -> bool {
        self.is_connected(&self.model)
    }

    pub fn is_connected(&self, model: &str) -> bool {
        self.connected.iter().any(|id| id == model)
    }

    pub fn library(&self, examples: &[Question]) -> Vec<Question> {
        let mut result: Vec<Question> = Vec::new();
        for question in examples
            .iter()
            .chain(self.interviews.iter().flat_map(|log| &log.questions))
        {
            let normalized = normalize(&question.title);
            if let Some(slot) = result
                .iter_mut()
                .find(|q| q.company_id == question.company_id && normalize(&q.title) == normalized)
            {
                if slot.demo || slot.at <= question.at {
                    *slot = question.clone();
                }
            } else {
                result.push(question.clone());
            }
        }
        result
    }
}

pub fn normalize(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

pub fn preferences_path() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("XDG_DATA_HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("ReplicaSlint").join("preferences.json")
}

pub fn examples() -> Vec<Question> {
    serde_json::from_str(include_str!("interview-examples.json"))
        .expect("checked-in demo interview questions")
}

pub fn format_date(date: &str) -> String {
    use chrono::Datelike;
    const MONTHS: [&str; 12] = [
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    ];
    chrono::DateTime::parse_from_rfc3339(date)
        .ok()
        .map(|date| format!("{} {}", date.day(), MONTHS[date.month0() as usize]))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_company_selection_preserves_the_original_company() {
        let custom = vec![Company {
            id: "custom-lab".into(),
            name: "Север Лаб".into(),
            logo: None,
        }];
        assert_eq!(
            matching_company("  OZON  ", &custom).as_deref(),
            Some("ozon")
        );
        assert_eq!(
            matching_company(" север лаб ", &custom).as_deref(),
            Some("custom-lab")
        );
        assert_eq!(matching_company("Другая компания", &custom), None);
        assert_eq!(company_initials("  север  лаб  третий "), "СЛ");
    }

    #[test]
    fn demo_library_is_compatible_with_original() {
        let library = Preferences::default().library(&examples());
        assert_eq!(library.len(), 11);
        assert_eq!(
            library[0].title,
            "Когда индекс может замедлить базу данных?"
        );
        assert_eq!(format_date(&library[0].at), "19 ноября");
    }

    #[test]
    fn preferences_round_trip_replaces_existing_snapshot() {
        let folder = std::env::temp_dir().join(format!("replica-test-{}", uuid::Uuid::new_v4()));
        let file = folder.join("preferences.json");
        let mut prefs = Preferences::default();
        prefs.persist(&file).unwrap();
        prefs.model = "claude".into();
        prefs.resume = None;
        prefs.persist(&file).unwrap();
        let loaded = Preferences::load(&file);
        assert_eq!(loaded.model, "claude");
        assert!(loaded.resume.is_none());
        fs::remove_file(file).unwrap();
        fs::remove_dir(folder).unwrap();
    }
}
