// Renders public/og.png (1200x630 Open Graph card) from an inline SVG.
// Run with: node scripts/generate-og.mjs
// Re-run whenever branding/colors change. No network required.
import sharp from "sharp";

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05070e"/>
      <stop offset="0.55" stop-color="#0a1030"/>
      <stop offset="1" stop-color="#101742"/>
    </linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="0.55" stop-color="#818cf8"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.6" stop-color="#e0f2fe"/>
      <stop offset="1" stop-color="#a5b4fc"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04080f" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#04080f" stop-opacity="0.68"/>
      <stop offset="1" stop-color="#04080f" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000010" stop-opacity="0.5"/>
    </radialGradient>
    <filter id="blur8" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <filter id="blur10" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>

  <!-- background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g fill="#bae6fd">
    <circle cx="140" cy="120" r="2" opacity="0.3"/>
    <circle cx="300" cy="80" r="1.6" opacity="0.25"/>
    <circle cx="520" cy="140" r="2" opacity="0.3"/>
    <circle cx="760" cy="60" r="1.6" opacity="0.25"/>
    <circle cx="980" cy="130" r="2" opacity="0.3"/>
    <circle cx="1100" cy="90" r="2" opacity="0.25"/>
    <circle cx="640" cy="110" r="1.6" opacity="0.2"/>
    <circle cx="420" cy="90" r="2" opacity="0.2"/>
  </g>
  <g stroke="#94a3f8" stroke-width="1" opacity="0.05">
    <path d="M100 24 V606 M200 24 V606 M300 24 V606 M400 24 V606 M500 24 V606 M600 24 V606 M700 24 V606 M800 24 V606 M900 24 V606 M1000 24 V606 M1100 24 V606"/>
    <path d="M0 124 H1200 M0 224 H1200 M0 324 H1200 M0 424 H1200 M0 524 H1200"/>
  </g>

  <!-- ceiling + floor (deadly glow lines) -->
  <rect x="0" y="0" width="1200" height="24" fill="#0a1026"/>
  <path d="M0 24 H1200" stroke="url(#wave)" stroke-width="7" opacity="0.55" filter="url(#blur10)"/>
  <path d="M0 24 H1200" stroke="url(#wave)" stroke-width="3"/>
  <rect x="0" y="606" width="1200" height="24" fill="#0a1026"/>
  <path d="M0 606 H1200" stroke="url(#wave)" stroke-width="7" opacity="0.55" filter="url(#blur10)"/>
  <path d="M0 606 H1200" stroke="url(#wave)" stroke-width="3"/>

  <!-- pillar walls with safe-gap accents -->
  <g fill="#586eeb" fill-opacity="0.16" stroke="#818cf8" stroke-opacity="0.38" stroke-width="1.5">
    <rect x="153" y="24" width="44" height="274"/>
    <rect x="153" y="426" width="44" height="180"/>
    <rect x="328" y="24" width="44" height="382"/>
    <rect x="328" y="534" width="44" height="72"/>
    <rect x="503" y="24" width="44" height="274"/>
    <rect x="503" y="426" width="44" height="180"/>
    <rect x="678" y="24" width="44" height="382"/>
    <rect x="678" y="534" width="44" height="72"/>
    <rect x="853" y="24" width="44" height="274"/>
    <rect x="853" y="426" width="44" height="180"/>
    <rect x="1028" y="24" width="44" height="382"/>
    <rect x="1028" y="534" width="44" height="72"/>
  </g>
  <g stroke="#67e8f9" stroke-width="3" opacity="0.55">
    <path d="M153 298 H197 M153 426 H197"/>
    <path d="M328 406 H372 M328 534 H372"/>
    <path d="M503 298 H547 M503 426 H547"/>
    <path d="M678 406 H722 M678 534 H722"/>
    <path d="M853 298 H897 M853 426 H897"/>
    <path d="M1028 406 H1072 M1028 534 H1072"/>
  </g>

  <!-- speed lines -->
  <g stroke="#22d3ee" stroke-width="4" stroke-linecap="round" opacity="0.18">
    <path d="M40 500 L140 438"/>
    <path d="M95 545 L195 483"/>
  </g>

  <!-- the wave -->
  <polyline points="0,470 175,362 350,470 525,362 700,470 875,362 1050,470 1200,362"
            fill="none" stroke="url(#wave)" stroke-width="14" opacity="0.6"
            stroke-linejoin="round" stroke-linecap="round" filter="url(#blur10)"/>
  <polyline points="0,470 175,362 350,470 525,362 700,470 875,362 1050,470 1200,362"
            fill="none" stroke="url(#wave)" stroke-width="9"
            stroke-linejoin="round" stroke-linecap="round"/>

  <!-- player ball riding the final slope -->
  <circle cx="1160" cy="402" r="24" fill="#67e8f9" opacity="0.35" filter="url(#blur8)"/>
  <circle cx="1160" cy="402" r="13" fill="#ffffff"/>

  <!-- readability band -->
  <rect x="0" y="140" width="1200" height="200" fill="url(#band)"/>

  <!-- title -->
  <text x="600" y="262" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif"
        font-weight="900" font-size="132" fill="none" stroke="#22d3ee"
        stroke-width="8" opacity="0.35" filter="url(#blur8)">WAVE DASH</text>
  <text x="600" y="262" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif"
        font-weight="900" font-size="132" letter-spacing="4" fill="url(#titleGrad)">WAVE DASH</text>
  <text x="600" y="318" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif"
        font-weight="700" font-size="33" letter-spacing="7" fill="#67e8f9" opacity="0.95">HOLD TO FLY · RELEASE TO DIVE</text>

  <!-- corner branding -->
  <rect x="56" y="44" width="6" height="40" rx="3" fill="url(#wave)"/>
  <text x="76" y="72" font-family="Arial, 'Segoe UI', sans-serif" font-weight="800"
        font-size="24" letter-spacing="5" fill="#cbd5f5">AURA++ GAMES</text>
  <text x="1144" y="72" text-anchor="end" font-family="Arial, 'Segoe UI', sans-serif"
        font-weight="700" font-size="22" letter-spacing="3" fill="#7c8cb0">V2.0</text>

  <!-- bottom pill -->
  <rect x="360" y="552" width="480" height="52" rx="26" fill="#0a0f20" fill-opacity="0.72"
        stroke="#67e8f9" stroke-opacity="0.3" stroke-width="1.5"/>
  <text x="600" y="585" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif"
        font-weight="700" font-size="23" letter-spacing="3" fill="#a5f3fc">PLAY FREE IN YOUR BROWSER</text>

  <rect width="1200" height="630" fill="url(#vig)"/>
</svg>
`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile("public/og.png");
console.log("public/og.png written (1200x630)");
