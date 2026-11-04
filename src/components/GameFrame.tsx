"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useAuth, SignIn } from "@clerk/nextjs";

/**
 * Hosts the self-contained canvas game (/wave-dash.html) fullscreen.
 * - Focuses the iframe on load and on any click inside it, so keyboard
 *   controls work immediately without an extra click.
 * - Offers a fullscreen toggle that stays out of the way while playing.
 * - Clerk auth bridge: relays the signed-in user ({ id, name }) from the Next
 *   shell to the game iframe via postMessage (wd-auth-user), and opens a
 *   themed sign-in dialog when the game requests it (wd-auth-open).
 */
export default function GameFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();

  useEffect(() => {
    const focusFrame = () => {
      frameRef.current?.contentWindow?.focus();
    };
    focusFrame();
    window.addEventListener("focus", focusFrame);
    return () => window.removeEventListener("focus", focusFrame);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const { firstName, lastName, imageUrl, primaryEmailAddress } = user || {};
  const displayName =
    (firstName && lastName ? `${firstName} ${lastName}` : firstName) ||
    primaryEmailAddress?.emailAddress ||
    (isSignedIn ? "Player" : null);

  const postToGame = useCallback(
    (msg: { type: string; user?: { id: string; name: string } | null }) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame) return;
      try {
        frame.postMessage(
          { scope: "wave-dash", ...msg },
          location.origin
        );
      } catch (e) {}
    },
    []
  );

  /* Relay the current Clerk user to the game iframe once auth is ready. */
  useEffect(() => {
    if (!isLoaded) return;
    postToGame({
      type: "wd-auth-user",
      user: isSignedIn && user
        ? { id: user.id, name: displayName || "Player" }
        : null,
    });
  }, [isLoaded, isSignedIn, user, displayName, postToGame]);

  /* Listen for sign-in requests from inside the game iframe. */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const data = e.data;
      if (!data || data.scope !== "wave-dash") return;
      if (data.type === "wd-auth-open") setShowSignIn(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    postToGame({ type: "wd-auth-user", user: null });
    setShowSignIn(false);
  }, [signOut, postToGame]);

  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => {});
  }, []);

  return (
    <main style={{ margin: 0, padding: 0, background: "#000", position: "relative" }}>
      <iframe
        ref={frameRef}
        title="Wave Dash"
        src="/wave-dash.html"
        className="wave-dash-frame"
        allow="autoplay; fullscreen"
      />
      {!isFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Enter fullscreen"
          title="Fullscreen"
          className="wd-frame-fullscreen-btn"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      )}

      {/* Themed Clerk sign-in dialog (dark neon, matches the game). */}
      {showSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="w-full max-w-md mx-6 bg-neutral-950 border border-neutral-800 rounded-2xl p-8 shadow-[0_0_80px_-20px_rgba(251,113,133,0.4)] animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-neutral-400 drop-shadow-md">Sign in to Wave Dash</h2>
              <button
                type="button"
                onClick={() => setShowSignIn(false)}
                className="wd-focusable w-7 h-7 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 flex items-center justify-center hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
                aria-label="Close sign in"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-neutral-400 text-sm mb-8">Sign in securely with Clerk to save runs and climb the leaderboard.</p>
            <div className="flex flex-col gap-4">
              {!isLoaded ? null : isSignedIn ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800 mb-4">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-neutral-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-medium">{displayName?.[0] || "?"}</div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-white">{displayName || "Player"}</div>
                      <div className="text-[11px] text-neutral-500">{user?.id}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="wd-focusable w-full py-2.5 rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200 font-semibold text-sm hover:bg-neutral-700 hover:text-white active:scale-95 transition-all cursor-pointer"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <SignIn
                    appearance={{
                      variables: {
                        colorPrimary: "#00f5d4",
                        colorBackground: "#0a0a0a",
                        colorForeground: "#ffffff",
                        colorDanger: "#ff006e",
                        colorSuccess: "#00f5d4",
                        fontFamily: '"Inter", sans-serif',
                        borderRadius: "12px",
                      },
                      elements: {
                        rootBox: "flex flex-col gap-4",
                        headerTitle: "text-2xl font-bold text-white mb-2",
                        headerSubtitle: "text-neutral-400 text-sm mb-6",
                        formButtonPrimary: "w-full py-3 rounded-xl bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white font-bold shadow-[0_0_40px_-12px_rgba(251,113,133,0.6)] hover:from-rose-400 hover:to-rose-600 transition-all",
                        socialButtonsBlockButton: "w-full py-3 rounded-xl border border-neutral-700 bg-neutral-900/80 text-neutral-200 font-medium hover:bg-neutral-800 transition-colors",
                        socialButtonsBlockIcon: "w-5 h-5",
                        card: "w-full rounded-2xl bg-neutral-950 border border-neutral-800 p-6 shadow-[0_0_60px_-20px_rgba(251,113,133,0.35)]",
                      },
                    }}
                    routing="hash"
                    fallbackRedirectUrl="/"
                  />
                  <p className="mt-4 text-center text-xs text-neutral-500">
                    Don&apos;t want an account? <button
                      type="button"
                      onClick={() => setShowSignIn(false)}
                      className="text-rose-400 underline underline-offset-4 hover:text-rose-300 cursor-pointer"
                    >
                      Continue as guest
                    </button>
                  </p>
                </>
              )}
            </div>
            <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-neutral-600 text-center">
              Powered by Clerk &bull; Wave Dash v2.2.0
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
