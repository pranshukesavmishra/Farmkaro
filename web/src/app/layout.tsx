import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AuthProvider } from "@/components/auth-context";
import { LangProvider } from "@/lib/i18n";
import { SampleDataBanner } from "@/components/sample-data-banner";
import { MobileTabBar } from "@/components/mobile-tabbar";

export const metadata: Metadata = {
  // Canonicals point at the production domain from every mirror (github.io
  // included), so Google consolidates all signals onto farmkaro.in.
  metadataBase: new URL("https://farmkaro.in"),
  title: {
    // The tab reads just the brand; inner pages become "About us · FarmKaro".
    default: "FarmKaro",
    template: "%s · FarmKaro",
  },
  description:
    "FarmKaro makes it safe to lease out farmland and makes leased-in land bankable. Verified parcels, honest document status, registered fixed-term leases. Jabalpur pilot district, Madhya Pradesh.",
  applicationName: "FarmKaro",
  keywords: [
    "farmkaro",
    "farmland lease India",
    "lease farmland Jabalpur",
    "agricultural land rent Madhya Pradesh",
    "खेत किराये पर",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FarmKaro",
    title: "FarmKaro",
    description:
      "Making it safe to lease out farmland — and making leased-in land bankable. Jabalpur pilot.",
    url: "https://farmkaro.in",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "FarmKaro — farmland leasing, done safely" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FarmKaro",
    description: "Making it safe to lease out farmland — and making leased-in land bankable.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

/** Structured data: who FarmKaro is, for Google's knowledge panel. */
const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FarmKaro",
  url: "https://farmkaro.in",
  logo: "https://farmkaro.in/icon.svg",
  slogan: "Making it safe to lease out farmland — and making leased-in land bankable.",
  founder: [
    { "@type": "Person", name: "Pranshu Kesav Mishra" },
    { "@type": "Person", name: "Aryan Singh" },
  ],
  areaServed: { "@type": "AdministrativeArea", name: "Jabalpur district, Madhya Pradesh, India" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "nextgradeinfo@gmail.com",
    availableLanguage: ["en", "hi"],
  },
});

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSONLD }} />

      </head>
      <body className="min-h-screen antialiased">
        <LangProvider>
          <AuthProvider>
            <SampleDataBanner />
            <SiteHeader />
            <main>{children}</main>
            <MobileTabBar />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
