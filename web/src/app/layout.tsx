import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AuthProvider } from "@/components/auth-context";
import { SampleDataBanner } from "@/components/sample-data-banner";

export const metadata: Metadata = {
  title: {
    default: "FarmKaro — Lease farmland with confidence",
    template: "%s · FarmKaro",
  },
  description:
    "FarmKaro makes it safe to lease out farmland and makes leased-in land bankable. Real parcel boundaries, honest document status, digital leases. Jabalpur pilot district.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#001A10" },
  ],
};

/** Applied before paint so the first frame is already in the right theme. */
const THEME_INIT = `
(function(){try{
  var t=localStorage.getItem('fk-theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
    document.documentElement.classList.add('dark');
  }
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <style>{`:root{--font-sans:"Instrument Sans",system-ui,sans-serif;--font-mono:"IBM Plex Mono",ui-monospace,monospace}`}</style>
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <SampleDataBanner />
          <SiteHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
