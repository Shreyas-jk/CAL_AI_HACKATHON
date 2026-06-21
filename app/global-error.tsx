"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#0a0a12] text-white flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-gray-400 text-sm">{error.message}</p>
          <button onClick={reset} className="px-4 py-2 bg-accent rounded-lg text-white">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
