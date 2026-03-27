const notes = [
  "Quiet triage instead of endless sorting.",
  "Editable AI reply drafts before anything leaves your inbox.",
  "A desktop product and a website that can evolve independently.",
];

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Arx</p>
        <h1>Email should feel lighter.</h1>
        <p className="lede">
          The website now lives beside the desktop app in the same repository,
          without forcing them into the same build.
        </p>
        <div className="actions">
          <a href="http://localhost:1421">Desktop Dev UI</a>
          <span>Run `pnpm tauri dev` for the app and `pnpm web` for this site.</span>
        </div>
      </section>

      <section className="panel">
        <div>
          <p className="label">Workspace</p>
          <p className="value">apps/desktop</p>
        </div>
        <div>
          <p className="label">Website</p>
          <p className="value">apps/web</p>
        </div>
        <div>
          <p className="label">Tooling</p>
          <p className="value">pnpm workspaces + turbo</p>
        </div>
      </section>

      <section className="notes">
        {notes.map((note) => (
          <article key={note} className="note">
            {note}
          </article>
        ))}
      </section>
    </main>
  );
}
