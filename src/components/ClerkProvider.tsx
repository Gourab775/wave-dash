"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { PropsWithChildren } from "react";

/**
 * Client wrapper for Next.js ClerkProvider so the App Router layout stays a
 * Server Component while providing Clerk auth context to the shell
 * (sign-in dialog, GameFrame postMessage bridge).
 */
export default function ClerkProviderWrapper({
  children,
}: PropsWithChildren) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
