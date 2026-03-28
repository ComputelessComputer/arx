import { cleanup, fireEvent, render, screen, waitFor, } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, } from "vitest";
import { SettingsView, } from "./SettingsView";
import type { MailAccount, } from "../../types/mail";

const { menuPopup, menuNew, menuItemNew, predefinedMenuItemNew, } = vi.hoisted(() => {
  const popup = vi.fn().mockResolvedValue(undefined);
  return {
    menuPopup: popup,
    menuNew: vi.fn().mockResolvedValue({ popup, }),
    menuItemNew: vi.fn((options: unknown,) => Promise.resolve(options,)),
    predefinedMenuItemNew: vi.fn((options: unknown,) => Promise.resolve(options,)),
  };
});

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew, },
  MenuItem: { new: menuItemNew, },
  PredefinedMenuItem: { new: predefinedMenuItemNew, },
}));

const account: MailAccount = {
  id: "account-1",
  provider: "gmail",
  displayName: "Personal",
  email: "person@example.com",
  capabilities: {
    archive: true,
    attachmentsRead: true,
    moveToInbox: true,
    sendHtml: true,
    star: true,
    threadView: true,
  },
  connectedAt: "2026-03-27T17:00:00.000Z",
  lastSyncedAt: "2026-03-27T17:05:00.000Z",
  archiveMailbox: null,
};

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
    menuPopup.mockClear();
    menuNew.mockClear();
    menuItemNew.mockClear();
    predefinedMenuItemNew.mockClear();
  });

  it("shows icon row actions and builds the account context menu", async () => {
    const onOpenConnectAccount = vi.fn();

    render(
      <SettingsView
        open
        busy={false}
        aiSettingsSaving={false}
        accounts={[account,]}
        accountChecks={{}}
        aiSettings={{
          provider: "openai",
          openaiApiKey: "",
          anthropicApiKey: "",
        }}
        error={null}
        removingAccountId={null}
        renamingAccountId={null}
        reconnectDraft={null}
        accountFormKey="new-account"
        showAccountForm={false}
        onAiSettingsChange={vi.fn()}
        onCancelConnectAccount={vi.fn()}
        onCheckAccount={vi.fn().mockResolvedValue(undefined)}
        onConnectAccount={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
        onOpenConnectAccount={onOpenConnectAccount}
        onRemoveAccount={vi.fn().mockResolvedValue(undefined)}
        onRenameAccount={vi.fn().mockResolvedValue(undefined)}
        onReconnectAccount={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("heading", { name: "Accounts", }),).not.toBeNull();
    expect(screen.queryByText("Connected",),).toBeNull();
    expect(screen.queryByText(/Added /,),).toBeNull();
    expect(screen.getByText(/Last synced /,),).not.toBeNull();
    expect(screen.getByRole("button", { name: "Check now", }),).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove account", }),).not.toBeNull();
    expect(screen.getByRole("button", { name: "Edit account name", }),).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add account", }),);
    expect(onOpenConnectAccount,).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Reconnect",),).toBeNull();

    const row = screen.getByText("Personal",).closest(".arx-settings-list-item");
    expect(row,).not.toBeNull();

    fireEvent.contextMenu(row!,);

    await waitFor(() => {
      expect(menuNew,).toHaveBeenCalledTimes(1);
    });

    expect(menuItemNew.mock.calls.map(([options],) => (options as { text: string; }).text,),).toEqual([
      "Check now",
      "Reconnect account",
      "Edit name",
      "Remove account",
    ]);
    expect(predefinedMenuItemNew,).toHaveBeenCalledWith({ item: "Separator", });
    expect(menuPopup,).toHaveBeenCalledTimes(1);
  });
});
