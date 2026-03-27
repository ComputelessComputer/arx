use crate::models::{
    AISuggestionBatch, DraftDocument, DraftRewriteTone, DraftStatus, MailAccount, Suggestion,
    SuggestionAction, ThreadDetail,
};
use crate::store::now_iso;
use uuid::Uuid;

pub fn rewrite_draft_text(text: &str, tone: DraftRewriteTone) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return match tone {
            DraftRewriteTone::Shorter => "Thanks for the note.\n\nI can take care of it and will follow up soon.\n\nBest,".to_string(),
            DraftRewriteTone::Professional => {
                "Hello,\n\nThank you for the note. I will review this and follow up shortly.\n\nBest regards,".to_string()
            }
            DraftRewriteTone::Friendly => {
                "Hi,\n\nThanks for sending this over. I will take a look and get back to you soon.\n\nBest,".to_string()
            }
        };
    }

    match tone {
        DraftRewriteTone::Shorter => trimmed
            .lines()
            .take(4)
            .map(|line| {
                line.replace("just ", "")
                    .replace("really ", "")
                    .replace("very ", "")
            })
            .collect::<Vec<_>>()
            .join("\n"),
        DraftRewriteTone::Professional => {
            let normalized = trimmed
                .replace("Hi,", "Hello,")
                .replace("Hi ", "Hello ")
                .replace("Thanks", "Thank you")
                .replace("Best,", "Best regards,");
            if normalized.contains("Thank you") {
                normalized
            } else {
                format!("Hello,\n\nThank you for the note.\n\n{normalized}")
            }
        }
        DraftRewriteTone::Friendly => {
            if trimmed.starts_with("Hi") {
                format!("{trimmed}\n\nBest,")
            } else {
                format!("Hi,\n\nThanks for the note.\n\n{trimmed}\n\nBest,")
            }
        }
    }
}

pub fn build_reply_draft(
    account: &MailAccount,
    detail: &ThreadDetail,
    suggested_body: Option<&str>,
) -> DraftDocument {
    let latest_inbound = detail
        .messages
        .iter()
        .rev()
        .find(|message| !message.is_outbound)
        .unwrap_or_else(|| {
            detail
                .messages
                .last()
                .expect("thread should have at least one message")
        });

    let recipient = latest_inbound.from.clone();
    let greeting = if recipient.name.trim().is_empty() {
        "Hi,".to_string()
    } else {
        format!("Hi {},", recipient.name)
    };
    let intro = suggested_body.unwrap_or("Thanks for the note. I will follow up shortly.");
    let closing = if account.display_name.trim().is_empty() {
        "Best,".to_string()
    } else {
        format!("Best,\n{}", account.display_name)
    };
    let quoted_text = latest_inbound
        .text
        .lines()
        .take(6)
        .collect::<Vec<_>>()
        .join("\n");
    let draft_text = format!("{greeting}\n\n{intro}\n\n{closing}\n\n{quoted_text}");

    let subject = if detail.thread.subject.to_lowercase().starts_with("re:") {
        detail.thread.subject.clone()
    } else {
        format!("Re: {}", detail.thread.subject)
    };

    DraftDocument {
        id: format!("draft-{}", Uuid::new_v4()),
        thread_id: detail.thread.id.clone(),
        account_id: detail.thread.account_id.clone(),
        subject,
        to: vec![recipient.clone()],
        cc: vec![],
        bcc: vec![],
        in_reply_to: Some(latest_inbound.provider_message_id.clone()),
        references: detail
            .messages
            .iter()
            .map(|message| message.provider_message_id.clone())
            .collect(),
        tiptap_json: serde_json::json!({
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": greeting }]
                },
                {
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": intro }]
                },
                {
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": closing }]
                },
                {
                    "type": "blockquote",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": quoted_text }]
                        }
                    ]
                }
            ]
        }),
        html: format!(
            "<p>{}</p><p>{}</p><p>{}</p><blockquote><p>{}</p></blockquote>",
            greeting.replace('\n', "<br />"),
            intro.replace('\n', "<br />"),
            closing.replace('\n', "<br />"),
            quoted_text.replace('\n', "<br />")
        ),
        text: draft_text,
        status: DraftStatus::Draft,
        updated_at: now_iso(),
    }
}

pub fn build_suggestion_batch(
    account: Option<&MailAccount>,
    threads: &[ThreadDetail],
) -> AISuggestionBatch {
    let batch_id = format!("batch-{}", Uuid::new_v4());
    let mut suggestions = Vec::new();

    for detail in threads {
        if suggestions.len() >= 8 {
            break;
        }

        let latest = match detail.messages.last() {
            Some(message) => message,
            None => continue,
        };
        let subject = detail.thread.subject.to_lowercase();
        let text = latest.text.to_lowercase();
        let sender_email = latest.from.email.to_lowercase();

        let suggestion = if subject.contains("digest")
            || subject.contains("newsletter")
            || subject.contains("receipt")
            || sender_email.contains("no-reply")
            || sender_email.contains("notifications")
        {
            Some((
                SuggestionAction::Archive,
                "Archive low-signal thread".to_string(),
                "The latest message reads like a bulk update or receipt.".to_string(),
                0.88,
                None,
            ))
        } else if text.contains("can you")
            || text.contains("could you")
            || text.contains("let me know")
            || text.contains('?')
            || detail.thread.needs_reply
        {
            let suggested_reply = build_reply_draft(
                account.unwrap_or(&MailAccount {
                    id: detail.thread.account_id.clone(),
                    provider: crate::models::ProviderKind::Gmail,
                    display_name: "Arx".to_string(),
                    email: String::new(),
                    capabilities: crate::models::ProviderCapabilities {
                        archive: true,
                        star: true,
                        move_to_inbox: true,
                        send_html: true,
                        thread_view: true,
                        attachments_read: true,
                    },
                    connected_at: now_iso(),
                    last_synced_at: None,
                    archive_mailbox: None,
                }),
                detail,
                Some(
                    "I can take care of this and will send the updated material by Friday morning.",
                ),
            );

            Some((
                SuggestionAction::DraftReply,
                "Prepare a reply draft".to_string(),
                "The latest message asks for a response or follow-up.".to_string(),
                0.81,
                Some(suggested_reply),
            ))
        } else if detail.thread.unread {
            Some((
                SuggestionAction::MarkRead,
                "Mark thread as read".to_string(),
                "The message looks informational and does not appear to need a response."
                    .to_string(),
                0.63,
                None,
            ))
        } else {
            None
        };

        if let Some((action, summary, reason, confidence, draft_reply)) = suggestion {
            suggestions.push(Suggestion {
                id: format!("suggestion-{}", Uuid::new_v4()),
                batch_id: batch_id.clone(),
                account_id: detail.thread.account_id.clone(),
                thread_id: detail.thread.id.clone(),
                action,
                summary,
                reason,
                confidence,
                selected: true,
                draft_reply,
            });
        }
    }

    let summary = if suggestions.is_empty() {
        "No obvious cleanup actions found in the current inbox slice.".to_string()
    } else {
        format!("{} suggestions ready for review", suggestions.len())
    };

    AISuggestionBatch {
        id: batch_id,
        summary,
        created_at: now_iso(),
        account_id: account.map(|item| item.id.clone()),
        suggestions,
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn professional_rewrite_adds_formal_phrasing() {
        let rewritten = rewrite_draft_text(
            "Hi,\n\nThanks for sending this.",
            DraftRewriteTone::Professional,
        );
        assert!(rewritten.contains("Hello"));
        assert!(rewritten.contains("Thank you"));
    }
}
