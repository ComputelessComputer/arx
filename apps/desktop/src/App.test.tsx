import { cleanup, fireEvent, render, screen, waitFor, } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, } from "vitest";
import App from "./App";
import type { AiSettings, AppSnapshot, } from "./types/mail";

vi.mock("./lib/api", () => ({
  bootstrapApp: vi.fn(),
  connectAccount: vi.fn(),
  loadAiSettings: vi.fn(),
  saveAiSettings: vi.fn(),
  syncAccount: vi.fn(),
}),);

const { bootstrapApp, loadAiSettings, } = await import("./lib/api");

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

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(bootstrapApp,).mockResolvedValue(EMPTY_SNAPSHOT,);
    vi.mocked(loadAiSettings,).mockResolvedValue(EMPTY_AI_SETTINGS,);
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

    fireEvent.click(screen.getByRole("button", { name: "Settings", }),);
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
  });
});
