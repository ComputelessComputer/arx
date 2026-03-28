import { cleanup, fireEvent, render, screen, } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, } from "vitest";
import { ConnectAccountForm, } from "./ConnectAccountForm";

describe("ConnectAccountForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("switches to manual mail settings through the provider picker", () => {
    render(
      <ConnectAccountForm
        busy={false}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Use a Google app password. OAuth is not wired yet.",),).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Provider Gmail", }),);
    fireEvent.click(screen.getByRole("option", { name: /IMAP \/ SMTP/i, }),);

    expect(screen.queryByText("Use a Google app password. OAuth is not wired yet.",),).toBeNull();
    expect(screen.getByText("IMAP host",),).not.toBeNull();
    expect(screen.getByText("SMTP host",),).not.toBeNull();
  });

  it("resets back to a blank add-account form when the form key changes", () => {
    const { rerender, } = render(
      <ConnectAccountForm
        key="reconnect-account-1"
        busy={false}
        draft={{
          accountId: "account-1",
          provider: "gmail",
          displayName: "Char",
          email: "john@hyprnote.com",
          imap: null,
        }}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect((screen.getByLabelText("Display name",) as HTMLInputElement).value,).toBe("Char");
    expect((screen.getByLabelText("Email",) as HTMLInputElement).value,).toBe("john@hyprnote.com");

    rerender(
      <ConnectAccountForm
        key="new-account"
        busy={false}
        draft={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect((screen.getByLabelText("Display name",) as HTMLInputElement).value,).toBe("");
    expect((screen.getByLabelText("Email",) as HTMLInputElement).value,).toBe("");
    expect((screen.getByLabelText("App password",) as HTMLInputElement).value,).toBe("");
  });
});
