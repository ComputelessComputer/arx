import type { Editor, } from "@tiptap/core";
import { BubbleMenu, } from "@tiptap/react/menus";
import type { ReactNode, } from "react";

interface ComposerBubbleMenuProps {
  editor: Editor;
}

function Button({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
},) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`arx-bubble-button ${active ? "arx-bubble-button-active" : ""}`}
    >
      {children}
    </button>
  );
}

export function ComposerBubbleMenu({ editor, }: ComposerBubbleMenuProps,) {
  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 10,
      }}
      shouldShow={({ from, to, },) => from !== to}
    >
      <div className="arx-bubble-menu">
        <Button active={editor.isActive("bold",)} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </Button>
        <Button active={editor.isActive("italic",)} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </Button>
        <Button active={editor.isActive("underline",)} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </Button>
        <Button active={editor.isActive("bulletList",)} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          List
        </Button>
        <Button active={editor.isActive("blockquote",)} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </Button>
      </div>
    </BubbleMenu>
  );
}
