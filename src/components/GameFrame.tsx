"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hosts the self-contained canvas game (/wave-dash.html) fullscreen.
 * - Focuses the iframe on load and on any click inside it, so keyboard
 *   controls work immediately without an extra click.
 * - Offers a fullscreen toggle that stays out of the way while playing.
 */
export default function GameFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => {});
  }, []);

  return (
    <main style={{ margin: 0, padding: 0, background: "#000" }}>
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
    </main>
  );
}
