import logo from "../../logo.png";
import splashVideo from "../../polyplay_splashvideo_logo480.mp4";

const tips = [
  {
    title: "Quick actions",
    body: "Tap a track to play. Tap Aura + to build track aura."
  },
  {
    title: "Scrub",
    body: "Tap the waveform to seek. Long-press waveform to create a loop."
  },
  {
    title: "Loop edit",
    body: "Drag loop handles on the waveform or use Loop Start/End sliders."
  },
  {
    title: "Controls",
    body: "Use Prev/Next to change tracks and Play/Pause to control playback."
  },
  {
    title: "Uploads",
    body: "Open Admin to upload tracks, replace media, and manage your playlist."
  }
];

export function HelpApp() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-8 pt-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/20 bg-slate-900/85 p-4 shadow-glow backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={logo}
            alt="Polyplay logo"
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-300/20"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-100">Help and Tips</h1>
            <p className="truncate text-xs text-slate-400">How to use Polyplay</p>
          </div>
        </div>

        <a
          href="/index.html"
          className="rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-100"
        >
          Back to Player
        </a>
      </header>

      <main className="space-y-4 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-4">
        <video
          className="w-full rounded-xl border border-slate-300/20"
          src={splashVideo}
          playsInline
          autoPlay
          muted
          loop
          preload="metadata"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <section
              key={tip.title}
              className="rounded-xl border border-slate-300/15 bg-slate-950/60 p-3"
            >
              <h2 className="text-sm font-semibold text-slate-100">{tip.title}</h2>
              <p className="mt-1 text-sm text-slate-300">{tip.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
