"use client";

import { useEffect, useState } from "react";
import { useUser, SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/**
 * Theme-designed Clerk sign-in page (dark neon, matches Wave Dash).
 * Used as a standalone entry point and as the Clerk after-sign-in target.
 */
export default function SignInPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isLoaded) return null;
  if (isSignedIn) {
    /* After signing in, go back to the game shell so the postMessage bridge
       can relay the user into the iframe. */
    router.push("/");
    return null;
  }

  const appearance = {
    variables: {
      colorPrimary: "#00f5d4",
      colorBackground: "#050505",
      colorForeground: "#ffffff",
      colorDanger: "#ff006e",
      colorSuccess: "#00f5d4",
      fontFamily: '"Inter", system-ui, sans-serif',
      borderRadius: "12px",
    },
    elements: {
      rootBox: "flex flex-col gap-4 max-w-md mx-auto pt-20",
      headerTitle: "text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-neutral-400 drop-shadow-md mb-1",
      headerSubtitle: "text-neutral-400 text-sm mb-8",
      formButtonPrimary: "w-full py-3.5 rounded-xl bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white font-bold shadow-[0_0_45px_-12px_rgba(251,113,133,0.55)] hover:from-rose-400 hover:to-rose-600 transition-all duration-300",
      socialButtonsBlockButton: "w-full py-3 rounded-xl border border-neutral-700 bg-neutral-900/80 text-neutral-200 font-medium hover:bg-neutral-800 transition-all duration-300",
      socialButtonsBlockIcon: "w-5 h-5",
      card: "w-full rounded-2xl bg-neutral-950/90 border border-neutral-800 p-8 backdrop-blur-md shadow-[0_0_80px_-20px_rgba(251,113,133,0.4)]",
    },
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-rose-400 font-bold">WD</span>
          <span className="text-xl font-semibold tracking-tight text-white">Wave Dash</span>
        </div>
        <SignIn
          appearance={appearance}
          routing="hash"
        />
        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.2em] text-neutral-600">
          Powered by Clerk &bull; Wave Dash v2.2.0
        </p>
      </div>
    </div>
  );
}
