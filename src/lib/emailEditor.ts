import type { Extensions, JSONContent, } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { generateHTML, } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import type { DraftDocument, EmailParticipant, } from "../types/mail";

export function createEmailExtensions(placeholder?: string,) {
  const baseExtensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3,], },
      codeBlock: {
        HTMLAttributes: { class: "arx-code-block", },
      },
      blockquote: {
        HTMLAttributes: { class: "arx-quote-block", },
      },
    },),
  ];

  if (!placeholder) return baseExtensions;
  return [
    ...baseExtensions,
    Placeholder.configure({
      placeholder,
    },),
  ] satisfies Extensions;
}

export function emptyDoc(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", },],
  };
}

export function textToDoc(text: string,) {
  const trimmed = text.trimEnd();
  if (!trimmed) return emptyDoc();

  const paragraphs = trimmed.split(/\n{2,}/,).map((block,) => ({
    type: "paragraph",
    content: block.split("\n",).flatMap((line, lineIndex, lines,) => {
      const content: Array<Record<string, unknown>> = [];
      if (line) {
        content.push({ type: "text", text: line, },);
      }
      if (lineIndex < lines.length - 1) {
        content.push({ type: "hardBreak", },);
      }
      return content;
    },),
  }),);

  return {
    type: "doc",
    content: paragraphs,
  } satisfies JSONContent;
}

export function participantsToField(participants: EmailParticipant[],) {
  return participants
    .map((participant,) => participant.email.trim(),)
    .filter(Boolean,)
    .join(", ");
}

export function parseRecipientField(value: string,) {
  return value
    .split(",",)
    .map((entry,) => entry.trim(),)
    .filter(Boolean,)
    .map((email,) => ({
      name: email.split("@",)[0] ?? email,
      email,
    }),);
}

export function htmlToPlainText(html: string,) {
  const container = document.createElement("div",);
  container.innerHTML = html;
  container.querySelectorAll("br",).forEach((breakNode,) => {
    breakNode.replaceWith("\n",);
  },);
  container.querySelectorAll("p, div, li, blockquote, h1, h2, h3, pre",).forEach((node,) => {
    node.append("\n\n",);
  },);
  return container.textContent?.replace(/\n{3,}/g, "\n\n",).trim() ?? "";
}

export function serializeDoc(doc: JSONContent,) {
  const html = DOMPurify.sanitize(generateHTML(doc, createEmailExtensions(),), {
    USE_PROFILES: { html: true, },
  },);
  const text = htmlToPlainText(html,);
  return { html, text, };
}

export function buildDraftPatch(draft: DraftDocument, partial: Partial<DraftDocument>,) {
  const next = {
    ...draft,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  if (partial.tiptapJson) {
    const serialized = serializeDoc(partial.tiptapJson,);
    next.html = serialized.html;
    next.text = serialized.text;
  }

  return next;
}
