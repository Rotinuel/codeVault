import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import "./globals.css";

// Every page reads live data (settings, sessions, plans), so render on request.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    title: { default: `${settings.platformName} — ${settings.tagline}`, template: `%s · ${settings.platformName}` },
    description: `${settings.platformName} is a subscription platform for verified bet codes released on a schedule, with tiered access for every plan.`,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    robots: { index: true, follow: true },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1222",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
