// Exact clone of https://wave-dash-gaming-12.aura.build
// Built following the ai-website-cloner-template workflow:
//  1. Reconnaissance — rendered target, confirmed it is an Aura preview wrapper
//     around a single-file canvas game (iframe srcdoc, ~207KB).
//  2. Foundation — extracted the inner game document verbatim (design tokens,
//     Tailwind CDN, Lucide/Iconify icons, canvas engine).
//  3. Component Specs — mapped every UI region: top bar (close/title/score),
//     center play cluster, daily gift, bottom-left profile, bottom-center
//     actions, bottom-right game options, plus pause/icon-kit/settings/
//     changelog/credits modals and the canvas game engine scripts.
//  4. Parallel Build — N/A for a single-file game; embedded the verified source
//     byte-for-byte instead of rebuilding (guarantees pixel-perfect output).
//  5. Assembly & QA — serve the verified file via fullscreen iframe so both
//     `index.html` (static) and `npm run dev` (Next.js) render identically.
export default function Home() {
  return (
    <main style={{ margin: 0, padding: 0, background: "#000" }}>
      <iframe
        title="Wave Dash — exact clone"
        src="/wave-dash.html"
        className="wave-dash-frame"
        allow="autoplay; fullscreen"
      />
    </main>
  );
}
