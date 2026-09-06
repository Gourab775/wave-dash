import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, 32);
  if (!name) return null;
  return name;
}

// GET /api/state?player=NAME -> last session for that player
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const player = sanitizeName(searchParams.get("player"));
    if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
    const rows = await sql`
      SELECT player_name, last_score, best_score, mode, wave_size,
             theme_color, selected_icon, settings, updated_at
      FROM player_state WHERE player_name = ${player} LIMIT 1`;
    return NextResponse.json({ state: rows[0] ?? null });
  } catch (e) {
    console.error("GET /api/state failed", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

// PUT /api/state { player_name, last_score?, best_score?, mode?, wave_size?, theme_color?, selected_icon?, settings? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const player_name = sanitizeName(body.player_name ?? body.name ?? body.player);
    if (!player_name) return NextResponse.json({ error: "player_name required" }, { status: 400 });

    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null;
    const strOrNull = (v: unknown, max = 32) =>
      typeof v === "string" && v ? v.slice(0, max) : null;

    const last_score = numOrNull(body.last_score ?? body.lastScore);
    const best_score = numOrNull(body.best_score ?? body.bestScore);
    const mode = strOrNull(body.mode, 16);
    const wave_size = strOrNull(body.wave_size ?? body.waveSize, 16);
    const theme_color = strOrNull(body.theme_color ?? body.themeColor, 16);
    const selected_icon = strOrNull(body.selected_icon ?? body.selectedIcon, 32);
    const settings = body.settings && typeof body.settings === "object" ? JSON.stringify(body.settings) : null;

    await sql`
      INSERT INTO player_state (player_name, last_score, best_score, mode, wave_size, theme_color, selected_icon, settings, updated_at)
      VALUES (${player_name}, ${last_score}, ${best_score}, ${mode}, ${wave_size}, ${theme_color}, ${selected_icon},
        COALESCE(${settings}::jsonb, '{}'::jsonb), NOW())
      ON CONFLICT (player_name) DO UPDATE SET
        last_score = COALESCE(EXCLUDED.last_score, player_state.last_score),
        best_score = COALESCE(EXCLUDED.best_score, player_state.best_score),
        mode = COALESCE(EXCLUDED.mode, player_state.mode),
        wave_size = COALESCE(EXCLUDED.wave_size, player_state.wave_size),
        theme_color = COALESCE(EXCLUDED.theme_color, player_state.theme_color),
        selected_icon = COALESCE(EXCLUDED.selected_icon, player_state.selected_icon),
        settings = CASE WHEN EXCLUDED.settings = '{}'::jsonb THEN player_state.settings ELSE EXCLUDED.settings END,
        updated_at = NOW()`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/state failed", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export const POST = PUT;
