import { describe, expect, test, } from "vitest";
import { htmlToPlainText, serializeDoc, textToDoc, } from "./emailEditor";

describe("emailEditor", () => {
  test("serializes tiptap content into html and plaintext", () => {
    const serialized = serializeDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello team,", },],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted context", },],
            },
          ],
        },
      ],
    },);

    expect(serialized.html).toContain("<blockquote");
    expect(serialized.text).toContain("Hello team,");
    expect(serialized.text).toContain("Quoted context");
  });

  test("converts html into normalized plaintext", () => {
    const text = htmlToPlainText("<p>Hello</p><p>World</p><blockquote><p>Quoted</p></blockquote>",);
    expect(text).toBe("Hello\n\nWorld\n\nQuoted");
  });

  test("creates a doc from plain text paragraphs", () => {
    const doc = textToDoc("First line\nSecond line\n\nNew paragraph",);
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(2);
  });
});
