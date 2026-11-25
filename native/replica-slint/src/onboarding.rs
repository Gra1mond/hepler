use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct StyleSetup {
    pub answers: Vec<String>,
    pub saved: String,
}

const OPENING: &str = "Расскажите про недавнюю задачу. Что вы сделали и какой получился результат?";
const LAST: &str =
    "Как вы объяснили бы свой вклад интервьюеру? Ответьте так, как сказали бы вслух.";

impl StyleSetup {
    fn follow_up(answer: &str) -> &'static str {
        if answer.chars().any(|c| c.is_ascii_digit()) {
            "Вы назвали число. Как вы замерили результат и с чем его сравнили?"
        } else {
            "По чему вы поняли, что решение сработало? Приведите один пример или показатель."
        }
    }

    pub fn messages(&self) -> Vec<(bool, &str)> {
        let mut out = vec![(false, OPENING)];
        for (index, answer) in self.answers.iter().take(3).enumerate() {
            out.push((true, answer));
            match index {
                0 => out.push((false, Self::follow_up(answer))),
                1 => out.push((false, LAST)),
                _ => out.push((
                    false,
                    "Проверьте описание вашего стиля ниже. Его можно поправить перед сохранением.",
                )),
            }
        }
        out
    }

    pub fn answer(&mut self, draft: &str) {
        let draft = draft.trim();
        if self.saved.is_empty() && self.answers.len() < 3 && !draft.is_empty() {
            self.answers.push(draft.chars().take(3000).collect());
        }
    }

    pub fn suggested_summary(&self) -> String {
        let words = self
            .answers
            .iter()
            .map(|a| a.split_whitespace().count())
            .sum::<usize>();
        let length = if words < 75 {
            "Кратко, короткими фразами."
        } else {
            "Развёрнуто, с пояснением выбора."
        };
        let examples = if self
            .answers
            .iter()
            .any(|a| a.chars().any(|c| c.is_ascii_digit()))
        {
            "Показывать измеримый результат, если он известен."
        } else {
            "Объяснять результат через конкретный пример."
        };
        format!("{length} Описывать свой вклад от первого лица. {examples}")
    }
}

pub fn parse_hex(text: &str) -> Option<u32> {
    let text = text.trim();
    let text = text.strip_prefix('#').unwrap_or(text);
    (text.len() == 6 && text.bytes().all(|byte| byte.is_ascii_hexdigit()))
        .then(|| u32::from_str_radix(text, 16).ok())
        .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interview_adapts_follow_up_and_caps_at_three_answers() {
        let mut setup = StyleSetup::default();
        setup.answer("   ");
        assert_eq!(setup.messages().len(), 1);
        setup.answer("Сократил время на 20%");
        assert!(setup.messages().last().unwrap().1.contains("замерили"));
        for answer in ["Замерил время", "Поменял запрос", "Лишний ответ"]
        {
            setup.answer(answer);
        }
        assert_eq!(setup.answers.len(), 3);
        assert!(setup.suggested_summary().contains("измеримый"));
    }

    #[test]
    fn color_accepts_only_hex_rgb() {
        assert_eq!(parse_hex(" #fbbF24  "), Some(0xfbbf24));
        assert_eq!(parse_hex("+12345"), None);
        assert_eq!(parse_hex("#bad"), None);
    }
}
