import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, 32);
  if (!name) return null;
  return name;
}

// GET /api/scores?scope=top&limit=100
// GET /api/scores?scope=recent&player=NAME&limit=20
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? "top";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "100", 10) || 20, 1), 100);

    if (scope === "recent") {
      const player = sanitizeName(searchParams.get("player"));
      if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
      const rows = await sql`
        SELECT player_name AS name, score, mode, wave_size, created_at
        FROM scores WHERE player_name = ${player}
        ORDER BY created_at DESC LIMIT ${limit}`;
      return NextResponse.json({ scores: rows });
    }

    // default: leaderboard top scores
    const rows = await sql`
      SELECT player_name AS name, score, mode, wave_size, created_at
      FROM scores ORDER BY score DESC, created_at ASC LIMIT ${limit}`;
    return NextResponse.json({ leaderboard: rows });
  } catch (e) {
    console.error("GET /api/scores failed", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

// POST /api/scores { player_name, score, mode?, wave_size? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const player_name = sanitizeName(body.player_name ?? body.name ?? body.player);
    const score = Math.floor(Number(body.score));
    const mode = typeof body.mode === "string" ? body.mode.slice(0, 16) : "medium";
    const wave_size = typeof body.wave_size === "string" ? body.wave_size.slice(0, 16) : "normal";

    if (!player_name) return NextResponse.json({ error: "player_name required" }, { status: 400 });
    if (!Number.isFinite(score) || score <= 0) return NextResponse.json({ error: "invalid score" }, { status: 400 });

    await sql`
      INSERT INTO scores (player_name, score, mode, wave_size)
      VALUES (${player_name}, ${score}, ${mode}, ${wave_size})`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/scores failed", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
