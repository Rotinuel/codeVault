"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/Primitives";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card">
      <ErrorState title="We couldn't load this page" description="Please try again. If the problem continues, contact support." onRetry={reset} />
    </div>
  );
}
