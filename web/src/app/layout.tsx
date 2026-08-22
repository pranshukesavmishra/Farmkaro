import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AuthProvider } from "@/components/auth-context";
import { SampleDataBanner } from "@/components/sample-data-banner";
import { MobileTabBar } from "@/components/mobile-tabbar";

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
    { media: "(prefers-color-scheme: light)", color: "#F4F0E2" },
    { media: "(prefers-color-scheme: dark)", color: "#001A10" },
  ],
  // Lets the floating tab bar respect the home-indicator safe area.
  viewportFit: "cover",
};

/** Applied before paint so the first frame is already in the right theme. */
const THEME_INIT = `
(function(){try{
  var t=localStorage.getItem('fk-theme');
  // Dark is the default: satellite imagery is the product and it glows
  // against a deep canvas. An explicit light choice still wins.
  if(t!=='light'){ document.documentElement.classList.add('dark'); }
}catch(e){document.documentElement.classList.add('dark');}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />

      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <SampleDataBanner />
          <SiteHeader />
          <main>{children}</main>
          <MobileTabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
