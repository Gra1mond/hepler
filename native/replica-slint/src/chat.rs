use std::mem;

#[cfg(test)]
const INDEX_QUESTION: &str = "Когда индекс может замедлить базу данных?";
#[cfg(test)]
const BEHAVIORAL_QUESTION: &str = "Расскажите о своём вкладе в командный проект.";
#[cfg(test)]
const BENCHMARK_EXCHANGES: usize = 60;

#[derive(Debug, PartialEq, Eq)]
pub struct Answer {
    pub summary: String,
    pub explanation: String,
    pub example: String,
}

impl Answer {
    pub fn copy_text(&self) -> String {
        [&self.summary, &self.explanation, &self.example]
            .into_iter()
            .map(String::as_str)
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum RowStatus {
    Pending,
    Error,
    Complete(Answer),
}

#[derive(Debug, PartialEq, Eq)]
pub struct ChatRow {
    pub id: i32,
    pub question: String,
    pub status: RowStatus,
    context: RequestContext,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
enum AnswerFormat {
    Brief,
    #[default]
    Structured,
    Detailed,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct RequestContext {
    format: AnswerFormat,
    has_materials: bool,
}

#[derive(Clone, Copy)]
struct Attempt {
    id: i32,
    row_id: i32,
    should_fail: bool,
}

pub struct ChatState {
    pub draft: String,
    pub rows: Vec<ChatRow>,
    next_id: i32,
    active: Option<Attempt>,
    fail_next: bool,
    context: RequestContext,
}

impl Default for ChatState {
    fn default() -> Self {
        Self {
            draft: String::new(),
            rows: Vec::new(),
            next_id: 1,
            active: None,
            fail_next: false,
            context: RequestContext::default(),
        }
    }
}

impl ChatState {
    pub fn set_request_context(&mut self, format: &str, materials: Option<String>) {
        self.context = RequestContext {
            format: match format {
                "Краткий" => AnswerFormat::Brief,
                "Развёрнутый" => AnswerFormat::Detailed,
                _ => AnswerFormat::Structured,
            },
            has_materials: materials.is_some_and(|text| !text.is_empty()),
        };
    }

    /// Returns the active attempt ID. A retry keeps the row ID but starts a new attempt.
    pub fn active_id(&self) -> Option<i32> {
        self.active.map(|attempt| attempt.id)
    }

    pub fn active_row_id(&self) -> Option<i32> {
        self.active.map(|attempt| attempt.row_id)
    }

    pub fn submit(&mut self) -> Option<i32> {
        if self.active.is_some() || self.draft.trim().is_empty() {
            return None;
        }

        let question = mem::take(&mut self.draft).trim().to_owned();
        let id = self.allocate_id();
        self.rows.push(ChatRow {
            id,
            question,
            status: RowStatus::Pending,
            context: self.context,
        });
        self.start_attempt(id, id);
        Some(id)
    }

    pub fn stop(&mut self) -> bool {
        let Some(attempt) = self.active.take() else {
            return false;
        };
        let Some(index) = self.rows.iter().position(|row| row.id == attempt.row_id) else {
            return false;
        };

        let cancelled = self.rows.remove(index);
        if self.draft.is_empty() {
            self.draft = cancelled.question;
        }
        true
    }

    pub fn retry(&mut self, row_id: i32) -> Option<i32> {
        if self.active.is_some() {
            return None;
        }

        let row = self
            .rows
            .iter_mut()
            .find(|row| row.id == row_id && row.status == RowStatus::Error)?;
        if self.draft.trim() == row.question {
            self.draft.clear();
        }
        row.status = RowStatus::Pending;

        let attempt_id = self.allocate_id();
        self.start_attempt(attempt_id, row_id);
        Some(attempt_id)
    }

    pub fn finish(&mut self, attempt_id: i32) -> bool {
        let Some(attempt) = self.active.filter(|attempt| attempt.id == attempt_id) else {
            return false;
        };
        self.active = None;
        let Some(row) = self.rows.iter_mut().find(|row| row.id == attempt.row_id) else {
            return false;
        };

        if attempt.should_fail {
            row.status = RowStatus::Error;
            if self.draft.is_empty() {
                self.draft.clone_from(&row.question);
            }
        } else {
            row.status = RowStatus::Complete(demo_answer(&row.question, row.context));
        }
        true
    }

    pub fn fail_next(&mut self) {
        self.fail_next = true;
    }

    pub fn completed_count(&self) -> usize {
        self.rows
            .iter()
            .filter(|row| matches!(row.status, RowStatus::Complete(_)))
            .count()
    }

    pub fn reset(&mut self) {
        self.draft.clear();
        self.rows.clear();
        self.active = None;
    }

    #[cfg(test)]
    pub fn seed_long(&mut self) {
        self.reset();
        for index in 0..BENCHMARK_EXCHANGES {
            let question = if index % 2 == 0 {
                INDEX_QUESTION
            } else {
                BEHAVIORAL_QUESTION
            };
            let id = self.allocate_id();
            let context = RequestContext::default();
            self.rows.push(ChatRow {
                id,
                question: question.to_owned(),
                status: RowStatus::Complete(demo_answer(question, context)),
                context,
            });
        }
    }

    fn allocate_id(&mut self) -> i32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    fn start_attempt(&mut self, id: i32, row_id: i32) {
        self.active = Some(Attempt {
            id,
            row_id,
            should_fail: mem::take(&mut self.fail_next),
        });
    }
}

fn demo_answer(question: &str, context: RequestContext) -> Answer {
    let (summary, explanation, example) = if question.to_lowercase().contains("индекс") {
        (
            "Индекс ускоряет чтение,\nно может замедлять запись.",
            "При вставке, удалении или изменении индексируемого значения база обновляет затронутые индексы.",
            "Массовая загрузка в таблицу с несколькими индексами может занять больше времени, чем загрузка в таблицу без них.",
        )
    } else {
        (
            "Назовите свою роль, опишите решение и завершите измеримым результатом.",
            if context.has_materials {
                "Выберите из материалов проект, в котором хорошо виден ваш личный вклад. Объясните, почему вы приняли именно это решение."
            } else if context.format == AnswerFormat::Detailed {
                "Опишите исходную задачу и свою ответственность. Затем перечислите варианты, объясните критерии выбора и завершите результатом. Если точной метрики нет, укажите, как вы оценивали эффект."
            } else {
                "Начните с контекста задачи, затем объясните, почему выбрали этот подход и чем он помог команде."
            },
            "Я разобрал причины повторных обращений, изменил шаг проверки и сократил число повторов на 20%.",
        )
    };
    if context.format == AnswerFormat::Brief {
        return Answer {
            summary: summary.into(),
            explanation: String::new(),
            example: String::new(),
        };
    }
    Answer {
        summary: summary.into(),
        explanation: explanation.into(),
        example: example.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_nonempty_question_can_be_pending() {
        let mut chat = ChatState {
            draft: " \n ".into(),
            ..ChatState::default()
        };
        assert_eq!(chat.submit(), None);

        chat.draft = format!(" {INDEX_QUESTION} ");
        let id = chat.submit().unwrap();
        assert_eq!(chat.active_id(), Some(id));
        assert!(chat.draft.is_empty());
        assert_eq!(chat.rows[0].question, INDEX_QUESTION);
        assert_eq!(chat.rows[0].status, RowStatus::Pending);

        chat.draft = BEHAVIORAL_QUESTION.into();
        assert_eq!(chat.submit(), None);
        assert_eq!(chat.draft, BEHAVIORAL_QUESTION);
        assert!(chat.finish(id));
        assert_eq!(chat.completed_count(), 1);
        assert!(!chat.finish(id));
    }

    #[test]
    fn index_fixture_has_the_same_copyable_answer_as_the_web_chat() {
        let mut chat = ChatState {
            draft: "Когда ИНДЕКС может замедлить базу данных?".into(),
            ..ChatState::default()
        };
        let id = chat.submit().unwrap();
        assert!(chat.finish(id));

        let RowStatus::Complete(answer) = &chat.rows[0].status else {
            panic!("expected a completed answer");
        };
        assert_eq!(
            answer.copy_text(),
            concat!(
                "Индекс ускоряет чтение,\nно может замедлять запись.\n\n",
                "При вставке, удалении или изменении индексируемого значения база обновляет затронутые индексы.\n\n",
                "Массовая загрузка в таблицу с несколькими индексами может занять больше времени, чем загрузка в таблицу без них.",
            )
        );
    }

    #[test]
    fn failure_and_retry_keep_the_original_row_and_reject_stale_completion() {
        let mut chat = ChatState {
            draft: INDEX_QUESTION.into(),
            ..ChatState::default()
        };
        chat.fail_next();
        let first = chat.submit().unwrap();
        let row_id = chat.rows[0].id;
        assert_eq!(chat.retry(row_id), None);
        assert!(chat.finish(first));
        assert_eq!(chat.rows[0].status, RowStatus::Error);
        assert_eq!(chat.draft, INDEX_QUESTION);

        let retry = chat.retry(row_id).unwrap();
        assert_ne!(first, retry);
        assert_eq!(chat.rows.len(), 1);
        assert_eq!(chat.rows[0].id, row_id);
        assert_eq!(chat.active_row_id(), Some(row_id));
        assert!(chat.draft.is_empty());
        assert!(!chat.finish(first));
        assert!(chat.finish(retry));
        assert_eq!(chat.completed_count(), 1);
    }

    #[test]
    fn stop_discards_pending_exchange_and_preserves_a_newer_draft() {
        let mut chat = ChatState {
            draft: INDEX_QUESTION.into(),
            ..ChatState::default()
        };
        let cancelled = chat.submit().unwrap();
        assert!(chat.stop());
        assert!(chat.rows.is_empty());
        assert_eq!(chat.draft, INDEX_QUESTION);

        let pending = chat.submit().unwrap();
        assert!(!chat.finish(cancelled));
        chat.draft = BEHAVIORAL_QUESTION.into();
        assert!(chat.stop());
        assert!(!chat.finish(pending));
        assert_eq!(chat.draft, BEHAVIORAL_QUESTION);
    }

    #[test]
    fn reset_clears_the_transcript_without_reusing_pending_identifiers() {
        let mut chat = ChatState {
            draft: INDEX_QUESTION.into(),
            ..ChatState::default()
        };
        let first = chat.submit().unwrap();
        chat.draft = BEHAVIORAL_QUESTION.into();
        chat.reset();
        assert!(chat.rows.is_empty());
        assert!(chat.draft.is_empty());
        assert_eq!(chat.active_row_id(), None);

        chat.draft = INDEX_QUESTION.into();
        let next = chat.submit().unwrap();
        assert_ne!(first, next);
        assert!(!chat.finish(first));
        assert!(chat.finish(next));
    }

    #[test]
    fn long_fixture_is_deterministic_and_ignores_an_earlier_attempt() {
        let mut chat = ChatState {
            draft: INDEX_QUESTION.into(),
            ..ChatState::default()
        };
        let abandoned = chat.submit().unwrap();
        chat.seed_long();

        assert!(!chat.finish(abandoned));
        assert_eq!(chat.active_id(), None);
        assert_eq!(chat.completed_count(), BENCHMARK_EXCHANGES);
        assert_eq!(chat.rows[0].question, INDEX_QUESTION);
        assert_eq!(chat.rows[1].question, BEHAVIORAL_QUESTION);
    }

    #[test]
    fn brief_format_copies_only_the_summary() {
        let mut chat = ChatState {
            draft: INDEX_QUESTION.into(),
            ..ChatState::default()
        };
        chat.set_request_context("Краткий", None);
        let id = chat.submit().unwrap();
        assert!(chat.finish(id));

        let RowStatus::Complete(answer) = &chat.rows[0].status else {
            panic!("expected a completed answer");
        };
        assert_eq!(
            answer.copy_text(),
            "Индекс ускоряет чтение,\nно может замедлять запись."
        );
    }

    #[test]
    fn retry_uses_original_materials_and_format() {
        let mut chat = ChatState {
            draft: BEHAVIORAL_QUESTION.into(),
            ..ChatState::default()
        };
        chat.set_request_context("Развёрнутый", Some("Данные резюме".into()));
        chat.fail_next();
        let id = chat.submit().unwrap();
        assert!(chat.finish(id));
        chat.set_request_context("Краткий", None);

        let retry = chat.retry(id).unwrap();
        assert!(chat.finish(retry));
        let RowStatus::Complete(answer) = &chat.rows[0].status else {
            panic!("expected a completed answer");
        };
        assert!(
            answer
                .explanation
                .starts_with("Выберите из материалов проект")
        );
        assert!(!answer.example.is_empty());
    }
}
