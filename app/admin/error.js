"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/Primitives";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card">
      <ErrorState title="This admin page failed to load" description="Please try again. If it keeps failing, check the server logs." onRetry={reset} />
    </div>
  );
}
