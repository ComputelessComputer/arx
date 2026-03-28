import { cleanup, fireEvent, render, screen, waitFor, } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, } from "vitest";
import App from "./App";
import type { AiSettings, AppSnapshot, MailAccount, } from "./types/mail";

vi.mock("./lib/api", () => ({
  bootstrapApp: vi.fn(),
  connectAccount: vi.fn(),
  getAccountReconnectDraft: vi.fn(),
  loadAiSettings: vi.fn(),
  removeAccount: vi.fn(),
  saveAiSettings: vi.fn(),
  syncAccount: vi.fn(),
  updateAccountDisplayName: vi.fn(),
}),);

vi.mock("./services/updater", () => ({
  checkForUpdate: vi.fn(),
  consumePendingPostUpdate: vi.fn(),
}),);

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
}),);

const { bootstrapApp, loadAiSettings, removeAccount, saveAiSettings, syncAccount, } = await import("./lib/api");
const { checkForUpdate, consumePendingPostUpdate, } = await import("./services/updater");
const { confirm, } = await import("@tauri-apps/plugin-dialog");

const EMPTY_SNAPSHOT: AppSnapshot = {
  accounts: [],
  mailboxes: [],
  threads: [],
  suggestionBatches: [],
};

const EMPTY_AI_SETTINGS: AiSettings = {
  provider: "openai",
  openaiApiKey: "",
  anthropicApiKey: "",
};

const CONNECTED_ACCOUNT: MailAccount = {
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

function openSettings() {
  const trigger = screen.queryByRole("button", { name: "Settings", })
    ?? screen.queryByRole("button", { name: "Open settings", });

  if (trigger) {
    fireEvent.click(trigger,);
    return;
  }

  window.dispatchEvent(new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: ",",
    metaKey: true,
  },),);
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(bootstrapApp,).mockResolvedValue(EMPTY_SNAPSHOT,);
    vi.mocked(loadAiSettings,).mockResolvedValue(EMPTY_AI_SETTINGS,);
    vi.mocked(removeAccount,).mockResolvedValue(undefined,);
    vi.mocked(saveAiSettings,).mockResolvedValue(EMPTY_AI_SETTINGS,);
    vi.mocked(checkForUpdate,).mockResolvedValue(null,);
    vi.mocked(confirm,).mockResolvedValue(true,);
    vi.mocked(consumePendingPostUpdate,).mockResolvedValue(null,);
  });

  it("opens settings with Cmd+,", async () => {
    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    expect(screen.queryByRole("dialog", { name: "Settings", }),).toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ",",
      metaKey: true,
    },),);

    expect(await screen.findByRole("dialog", { name: "Settings", }),).not.toBeNull();
  });

  it("closes settings with Escape", async () => {
    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    openSettings();
    expect(await screen.findByRole("dialog", { name: "Settings", }),).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Escape",
    },),);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings", }),).toBeNull();
    },);
  });

  it("shows onboarding and opens settings from the empty state", async () => {
    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    expect(screen.getByText("Set up Arx",),).not.toBeNull();
    expect(screen.getByText("Connect your first inbox",),).not.toBeNull();
    expect(screen.getByText("Add an AI key",),).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open settings", }),);

    expect(await screen.findByRole("dialog", { name: "Settings", }),).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Connect your first email", }),).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Accounts", }),).toBeNull();
    expect(screen.queryByText("No mail account connected yet.",),).toBeNull();
  });

  it("autosaves ai settings after the key changes", async () => {
    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    openSettings();
    const apiKeyInput = await screen.findByPlaceholderText("sk-...",);

    vi.useFakeTimers();
    fireEvent.change(apiKeyInput, {
      target: {
        value: "sk-test",
      },
    },);

    await vi.advanceTimersByTimeAsync(300,);
    expect(saveAiSettings,).toHaveBeenCalledWith({
      provider: "openai",
      openaiApiKey: "sk-test",
      anthropicApiKey: "",
    },);
  });

  it("removes an account after confirmation", async () => {
    vi.mocked(bootstrapApp,).mockResolvedValue({
      ...EMPTY_SNAPSHOT,
      accounts: [CONNECTED_ACCOUNT,],
    },);

    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    openSettings();
    fireEvent.click(await screen.findByRole("button", { name: "Remove account", }),);

    await waitFor(() => {
      expect(confirm,).toHaveBeenCalledWith(
        "Remove Personal? This disconnects the inbox and deletes its local mail data from Arx.",
        {
          kind: "warning",
          okLabel: "Remove",
          title: "Remove account",
        },
      );
      expect(removeAccount,).toHaveBeenCalledWith("account-1");
    },);
  });

  it("clears stale sync errors when settings is opened", async () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mac",
    });
    vi.mocked(bootstrapApp,).mockResolvedValue({
      ...EMPTY_SNAPSHOT,
      accounts: [{
        ...CONNECTED_ACCOUNT,
        lastSyncedAt: new Date().toISOString(),
      },],
    });
    vi.mocked(syncAccount,).mockRejectedValue(new Error("No matching entry found in secure storage"));

    render(<App />);

    await waitFor(() => {
      expect(bootstrapApp,).toHaveBeenCalled();
      expect(loadAiSettings,).toHaveBeenCalled();
    },);

    fireEvent.click(screen.getByRole("button", { name: "Sync", }),);

    expect(await screen.findByText("No matching entry found in secure storage",),).not.toBeNull();

    openSettings();

    expect(await screen.findByRole("dialog", { name: "Settings", }),).not.toBeNull();
    expect(screen.queryAllByText("No matching entry found in secure storage",),).toHaveLength(0);

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });
});
