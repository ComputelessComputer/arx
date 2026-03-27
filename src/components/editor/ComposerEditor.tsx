import { EditorContent, useEditor, } from "@tiptap/react";
import type { JSONContent, } from "@tiptap/core";
import { ComposerBubbleMenu, } from "./ComposerBubbleMenu";
import { createEmailExtensions, } from "../../lib/emailEditor";

interface ComposerEditorProps {
  content: JSONContent;
  onChange: (doc: JSONContent,) => void;
}

export function ComposerEditor({ content, onChange, }: ComposerEditorProps,) {
  const editor = useEditor({
    extensions: createEmailExtensions("Draft the reply, then use AI actions only when useful.",),
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "arx-composer-editor",
      },
    },
    onUpdate({ editor, },) {
      onChange(editor.getJSON(),);
    },
  },);

  if (!editor) return null;

  return (
    <div className="arx-editor-shell">
      <ComposerBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

