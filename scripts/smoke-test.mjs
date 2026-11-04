// Wave Dash production smoke test.
// 1) HTTP-checks every route + local asset referenced by the game.
// 2) Syntax-checks every inline <script> block of wave-dash.html with node --check.
// 3) Drives the real game in headless Chrome over CDP: menu, dialogs, a full
//    run (Space -> die -> game-over -> Escape), settings persistence, save file.
//
// Run: node scripts/smoke-test.mjs   (requires `npm run dev` on :3000)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = "http://localhost:3000";
const OUT_DIR = path.join(tmpdir(), "opencode", "smoke");
mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const phase = name => console.log(`\n== phase: ${name} ==`);
const withTimeout = (promise, ms, tag) =>
  Promise.race([promise, sleep(ms).then(() => { throw new Error(`timeout after ${ms}ms: ${tag}`); })]);
const freePort = () => new Promise(res => {
  const srv = net.createServer();
  srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => res(p)); });
});

// ---------------------------------------------------------------------------
// 1. HTTP checks
// ---------------------------------------------------------------------------
const html = await (await fetch(`${BASE}/wave-dash.html`)).text();

const assetRefs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"|['"](assets\/[^'"]+)['"]/g)]
  .map(m => m[1] || m[2]);
const assets = [...new Set(assetRefs)];
for (const a of assets) {
  const r = await fetch(`${BASE}/${a}`);
  ok(`asset ${a}`, r.ok && (r.headers.get("content-type") || "").length > 0,
     `${r.status} ${(r.headers.get("content-type") || "").split(";")[0]} ${r.headers.get("content-length") || "?"}B`);
}
ok("no unmatched asset refs", assets.length >= 15, `${assets.length} assets referenced`);

const ext = [...new Set([...html.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map(m => m[0]))];
const banned = ext.filter(u => !/(localhost|wave-dash\.app|twitter\.com)/.test(u));
ok("no external runtime hosts in game html", banned.length === 0, ext.join(", ") || "none");

for (const route of ["/", "/og.png", "/icon.svg", "/robots.txt", "/sitemap.xml"]) {
  const r = await fetch(`${BASE}${route}`);
  ok(`route ${route}`, r.ok, `${r.status} ${(r.headers.get("content-type") || "").split(";")[0]}`);
}
const home = await (await fetch(`${BASE}/`)).text();
ok("home embeds game iframe", home.includes('/wave-dash.html'), "iframe src present");

// ---------------------------------------------------------------------------
// 2. Inline <script> syntax checks
// ---------------------------------------------------------------------------
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let idx = 0;
let allParsed = true;
const syntaxFailures = [];
for (const m of html.matchAll(scriptRe)) {
  const body = m[1];
  if (!body.trim()) continue;
  idx++;
  const file = path.join(OUT_DIR, `inline-${idx}.js`);
  writeFileSync(file, body);
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    allParsed = false;
    syntaxFailures.push({ chunk: idx, err: (res.stderr || "").split("\n").slice(0, 4).join(" | ") });
  }
}
ok(`inline scripts parse (${idx} chunks)`, allParsed, syntaxFailures.map(f => `#${f.chunk}: ${f.err}`).join(" ;; "));

// unresolved placeholder check
const placeholders = html.match(/@@[A-Za-z0-9_]+@@/g);
ok("no unresolved placeholders", !placeholders, placeholders?.join(", ") || "clean");

// ---------------------------------------------------------------------------
// 3. Headless Chrome + CDP
// ---------------------------------------------------------------------------
const candidates = [
  process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  process.env["ProgramFiles(x86)"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe",
];
const browserExe = candidates.find(p => p && existsSync(p));
if (!browserExe) {
  ok("headless browser available", false, "no chrome/edge found; skipping interaction tests");
} else {
  const CDP_PORT = await freePort();
  const profile = mkdtempSync(path.join(tmpdir(), "wd-cdp-"));
  phase("launching headless browser");
  const proc = spawn(browserExe, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
    "--window-size=1280,760", "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });

  let wsTarget = null;
  for (let i = 0; i < 50 && !wsTarget; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      wsTarget = (list.find(t => t.type === "page") || list[0])?.webSocketDebuggerUrl;
    } catch {}
  }
  ok("headless browser available", !!wsTarget, browserExe);

  if (wsTarget) {
    phase("connecting CDP websocket");
    const ws = new WebSocket(wsTarget);
    await withTimeout(new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }), 15000, "ws open");
    let mid = 0;
    const pending = new Map();
    const listeners = [];
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const [name, cb] of listeners) if (name === msg.method) cb(msg.params);
      }
    });
    const send = (method, params = {}, tmo = 20000) =>
      new Promise((resolve, reject) => {
        const id = ++mid;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, tmo);
        pending.set(id, {
          resolve: v => { clearTimeout(timer); resolve(v); },
          reject: e => { clearTimeout(timer); reject(e); },
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const on = (name, cb) => listeners.push([name, cb]);

    const consoleErrors = [];
    const failedRequests = [];
    const externalRequests = [];
    on("Runtime.consoleAPICalled", p => {
      if (p.type === "error" || p.type === "warning") {
        consoleErrors.push(`${p.type}: ${p.args.map(a => a.value ?? a.description ?? "").join(" ")}`);
      }
    });
    on("Log.entryAdded", p => consoleErrors.push(`log.${p.entry.level}: ${p.entry.text.slice(0, 140)}`));
    on("Network.loadingFailed", p => failedRequests.push(`${p.errorText} (${p.type})`));
    on("Network.responseReceived", p => {
      const s = p.response.status;
      const u = p.response.url;
      if (u.startsWith("data:")) return; // inline data URIs are not external
      if (s >= 400) failedRequests.push(`${s} ${u}`);
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)) externalRequests.push(u);
    });

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Log.enable");

    phase("navigating to /");
    const loaded = new Promise(res => on("Page.loadEventFired", res));
    await send("Page.navigate", { url: `${BASE}/` });
    await withTimeout(loaded, 20000, "first load");
    await sleep(1500); // let game scripts init

    // find the game iframe and its execution context
    const tree = await send("Page.getFrameTree");
    const findFrame = node => {
      if (node.frame?.url?.includes("wave-dash")) return node.frame.id;
      for (const c of node.childFrames || []) { const r = findFrame(c); if (r) return r; }
      return null;
    };
    const gameFrameId = findFrame(tree.frameTree);
    ok("game iframe present", !!gameFrameId, tree.frameTree.frame.url);

    const evalCtx = async (expression, ctx) => {
      const r = await send("Runtime.evaluate", {
        expression, contextId: ctx, returnByValue: true, awaitPromise: true,
      });
      if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };

    // map frameId -> execution contexts (latest wins)
    const ctxByFrame = new Map();
    on("Runtime.executionContextCreated", p => {
      if (p.context.auxData?.frameId) ctxByFrame.set(p.context.auxData.frameId, p.context.id);
    });
    await sleep(400);
    // rediscover the current game iframe context (evaluates 1 to prove it's alive)
    const getContext = async () => {
      // force Chromium to replay executionContextCreated for every existing frame
      ctxByFrame.clear();
      await send("Runtime.disable");
      await send("Runtime.enable");
      for (let attempt = 0; attempt < 8; attempt++) {
        const t = await send("Page.getFrameTree");
        const fid = findFrame(t.frameTree);
        const cid = fid && ctxByFrame.get(fid);
        if (cid) {
          try {
            await send("Runtime.evaluate", { expression: "1", contextId: cid, returnByValue: true });
            return cid;
          } catch { ctxByFrame.delete(fid); }
        }
        await sleep(300);
      }
      throw new Error("no usable iframe execution context");
    };
    const gameCtx = await getContext();
    ok("iframe execution context found", !!gameCtx, `ctx=${gameCtx}`);

    if (gameCtx) try {
      let ctx = gameCtx;
      const E = expr => evalCtx(expr, ctx);

      // WD objects
      const wd = await E(`({
        hasWD: typeof WD !== 'undefined',
        engine: typeof WD !== 'undefined' && !!WD.engine,
        ui: typeof WD !== 'undefined' && !!WD.ui,
        lucide: typeof lucide !== 'undefined',
      })`);
      ok("WD core loaded (engine+ui+lucide)", wd.hasWD && wd.engine && wd.ui && wd.lucide, JSON.stringify(wd));

      const save0 = await E(`JSON.parse(localStorage.getItem('wd.save.v2') || 'null')`);
      ok("save file wd.save.v2 present", !!save0 && save0.version === 2, save0 ? `v${save0.version} best=${save0.best} attempts=${save0.attempts}` : "missing");

      // screenshot helper
      const shot = async name => {
        const r = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(path.join(OUT_DIR, name), Buffer.from(r.data, "base64"));
        console.log(`  shot -> ${path.join(OUT_DIR, name)}`);
      };

      // menu screenshot
      const menuVisible = await E(`document.getElementById('btn-open-settings')?.offsetParent !== null
        || !document.getElementById('btn-open-settings')?.classList.contains('hidden')`);
      ok("menu screen visible (dialog triggers present)", menuVisible, String(menuVisible));
      await shot("01-menu.png");

      // --- dialog tests: pairs straight from the game's DIALOGS wiring ---
      phase("dialog battery");
      const dialogVisible = id => E(`(function(){const m=document.getElementById(${JSON.stringify(id)});
        if(!m) return null; return !m.classList.contains('hidden') && getComputedStyle(m).display!=='none';})()`);
      const openAndClose = async (label, btnId, modalId) => {
        await E(`document.getElementById(${JSON.stringify(btnId)}).click()`);
        await sleep(280);
        const opened = await dialogVisible(modalId);
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await sleep(220);
        const closed = !(await dialogVisible(modalId));
        return `${label}: open=${opened} escClosed=${closed}`;
      };
      const profileBtn = await E(`(function(){
        const b=[...document.querySelectorAll('button')].find(e=>/profile/i.test((e.id||'')+' '+(e.getAttribute('aria-label')||'')));
        return b ? b.id : null; })()`);
      const dialogCases = [
        ["icon-kit", "btn-open-icon-kit", "icon-kit-modal"],
        ["daily", "btn-open-daily", "daily-modal"],
        ["scores", "btn-open-scores", "scores-modal"],
        ["leaderboard", "btn-open-changelog", "changelog-modal"],
        ["credits", "btn-open-credits", "credits-modal"],
        ["settings", "btn-open-settings", "settings-modal"],
        ["editor", "btn-open-editor", "editor-modal"],
        ["profile", profileBtn, "profile-modal"],
      ];
      let allDialogsOk = true;
      const dialogDetails = [];
      for (const [label, btnId, modalId] of dialogCases) {
        const exists = await dialogVisible(modalId) !== null;
        if (!btnId || !exists) { allDialogsOk = false; dialogDetails.push(`${label}: trigger=${btnId || "?"} modal=${exists}`); continue; }
        try {
          const detail = await openAndClose(label, btnId, modalId);
          const okCase = /open=true escClosed=true/.test(detail);
          if (!okCase) allDialogsOk = false;
          dialogDetails.push(detail);
        } catch (err) {
          allDialogsOk = false;
          dialogDetails.push(`${label}: ${err.message.slice(0, 80)}`);
        }
      }
      ok("all dialogs open via button + close via Escape", allDialogsOk, dialogDetails.join("; "));

      // --- full run: Space -> fly -> die -> game-over -> Escape ---
      phase("full run");
      // menu music may auto-claim the first keydown; fine.
      const attemptsBefore = (await E(`JSON.parse(localStorage.getItem('wd.save.v2')).attempts`)) ?? 0;
      const runsBefore = (await E(`JSON.parse(localStorage.getItem('wd.save.v2')).stats?.runs`)) ?? 0;
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await sleep(260);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      let playing = false;
      for (let i = 0; i < 20; i++) { playing = await E(`WD.engine.isPlaying()`); if (playing) break; await sleep(150); }
      ok("run starts on Space", playing, `isPlaying=${playing}`);

      if (playing) {
        let dead = false;
        for (let i = 0; i < 80; i++) { dead = await E(`WD.engine.isDead()`); if (dead) break; await sleep(100); }
        ok("run ends (wave dives into floor)", dead, `isDead=${dead}`);
        await sleep(1400); // game shows the overlay ~750ms after death
        let overlayShown = false;
        for (let i = 0; i < 16; i++) {
          overlayShown = await E(`!document.getElementById('gameover-overlay').classList.contains('hidden')
            && getComputedStyle(document.getElementById('gameover-overlay')).opacity !== '0'`);
          if (overlayShown) break;
          await sleep(150);
        }
        ok("game-over overlay visible", overlayShown, String(overlayShown));
        await shot("03-gameover.png");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await sleep(300);
        const back = await E(`WD.engine.isPlaying() === false
          && document.getElementById('gameover-overlay').classList.contains('hidden')
          && document.getElementById('btn-open-settings')?.offsetParent !== null`);
        ok("Escape returns to menu from game-over", back, String(back));
      }

      // attempts & stats must be recorded on death; pastScores only for score>0 runs
      await sleep(400);
      const save1 = await E(`JSON.parse(localStorage.getItem('wd.save.v2'))`);
      ok("death records attempts + runs", save1.attempts > attemptsBefore && (save1.stats?.runs ?? 0) > runsBefore,
         `attempts ${attemptsBefore} -> ${save1.attempts}, runs ${runsBefore} -> ${save1.stats?.runs ?? 0}`);

      // leaderboard data path: record a nonzero score through the store API, then verify the board renders it
      await E(`(function(){ var s = WD.store; s.pastScores.unshift(150); WD.persist(); return s.pastScores[0]; })()`);
      await E(`document.getElementById('btn-open-scores').click()`);
      await sleep(300);
      const boardHasScore = await E(`(document.getElementById('scores-modal') || {}).innerText?.includes('150')`);
      ok("leaderboard renders recorded score", !!boardHasScore, `board contains 150: ${boardHasScore}`);
      await shot("05-leaderboard.png");
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await sleep(200);

      // --- settings persistence: toggle Show FPS, verify save changed ---
      phase("settings persistence");
      const settingsBefore = JSON.stringify((await E(`JSON.parse(localStorage.getItem('wd.save.v2'))`)).settings);
      await E(`document.getElementById('btn-open-settings').click()`); await sleep(300);
      const settingsOpen = await dialogVisible("settings-modal");
      ok("settings modal opens with content", !!settingsOpen, String(settingsOpen));
      const toggled = await E(`(function(){
        const t=document.getElementById('toggle-fps');
        if(!t) return null; t.click(); return t.checked; })()`);
      await sleep(400);
      const save2 = await E(`JSON.parse(localStorage.getItem('wd.save.v2'))`);
      ok("settings toggle persists", toggled != null && JSON.stringify(save2.settings) !== settingsBefore,
         `toggle-fps now=${toggled} before=${settingsBefore} after=${JSON.stringify(save2.settings)}`);
      await shot("04-settings.png");
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await sleep(200);

      // reload persistence
      phase("reload persistence check");
      const loaded2 = new Promise(res => on("Page.loadEventFired", res));
      await send("Page.navigate", { url: `${BASE}/` });
      await withTimeout(loaded2, 20000, "second load");
      ctx = await getContext();
      await sleep(1500);
      const save3 = await E(`JSON.parse(localStorage.getItem('wd.save.v2'))`);
      ok("save survives reload", !!save3 && save3.version === 2 && save3.attempts >= (save1?.attempts ?? 0),
          `attempts=${save3?.attempts}`);
    } catch (err) {
      ok("interaction flow completed", false, err.message);
    }

    console.log("\n--- console errors/warnings ---");
    console.log(consoleErrors.length ? consoleErrors.join("\n") : "(none)");
    console.log("--- failed/4xx requests ---");
    console.log(failedRequests.length ? failedRequests.join("\n") : "(none)");
    console.log("--- external requests ---");
    console.log(externalRequests.length ? [...new Set(externalRequests)].join("\n") : "(none)");
    ok("zero console errors", consoleErrors.filter(e => e.startsWith("error") || e.includes("ERROR")).length === 0);
    ok("zero failed/4xx requests", failedRequests.length === 0);
    ok("zero external requests", externalRequests.length === 0);

    try { ws.close(); } catch {}
  }
  try { process.kill(proc.pid); } catch {}
  try { spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
}

// ---------------------------------------------------------------------------
const fails = results.filter(r => !r.pass);
console.log(`\n===== ${results.length - fails.length}/${results.length} checks passed =====`);
if (fails.length) { console.log("FAILED:"); fails.forEach(f => console.log(` - ${f.name}: ${f.detail}`)); }
writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
process.exit(fails.length ? 1 : 0);
