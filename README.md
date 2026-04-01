# Arx

<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128.png" alt="Arx icon" width="96" height="96" />
</p>

Arx is an AI inbox client for people who want a quieter inbox without handing control to a black box.

It is built around a simple idea: email should feel lighter. The app helps you clear low-signal mail, draft replies faster, and keep the final decision in your hands.

> Disclaimer: Arx is an experimental proof-of-concept app, not a production-ready standalone product. This work is intended to be integrated into the [Char repository](https://github.com/fastrepl/char).

## Repo Layout

- `apps/desktop`: Tauri desktop app
- `apps/web`: website

## Local Development

```bash
pnpm install
pnpm tauri dev
```

For the website:

```bash
pnpm web
```

## Manifesto

- Your inbox should get quieter, not louder.
- AI should suggest work, not silently do work.
- Triage and reply should live in the same place.
- Fast, editable drafts are better than robotic auto-send.
- Local control matters when your email is involved.

## What Arx Is For

Arx is for people who spend too much time sorting, skimming, and rewriting email. Instead of making you bounce between filters, folders, and half-finished drafts, Arx puts the core workflow in one desktop app:

- review what matters
- clear what does not
- generate reply drafts
- confirm every real mailbox action

## How It Works

1. Connect a mail account.
2. Sync your inbox into Arx.
3. Generate an AI review batch.
4. Approve the suggestions you actually want.
5. Edit or send reply drafts from the built-in composer.

Arx is designed around `suggest + confirm`. Archive, read/unread changes, stars, move-to-inbox actions, and reply drafts stay explicit. Nothing important should happen behind your back.

## What Arx Aims To Support

- Gmail
- Outlook
- IMAP / SMTP
- AI-assisted inbox cleanup
- AI-assisted reply drafting
- Rich-text email editing
- Local message cache for a fast desktop experience

## Privacy And Control

- Message data is cached locally on your machine.
- Account secrets are stored in your OS credential store.
- AI suggestions are reviewable before they touch your mailbox.
- Draft replies stay editable before send.

## Current Status

Arx is in early preview as an experimental proof-of-concept.

The current build already has the desktop app shell, local cache, AI review queue, and rich-text reply composer. Live Gmail, Outlook, and IMAP syncing are still being finished, so this version should be treated as a product preview rather than a fully production-ready mail client.

## Why Arx Exists

Most email software forces a bad tradeoff. You either do everything manually, or you let automation act with too little context and too much confidence.

Arx takes a stricter approach: let AI do the reading, grouping, and drafting, but keep the human in charge of the mailbox.

A lot of the thinking behind Arx was shaped by [Horseless Carriages](https://koomen.dev/essays/horseless-carriages/).

## Get Arx

Download the latest build from the [Releases](https://github.com/ComputelessComputer/arx/releases) page.
