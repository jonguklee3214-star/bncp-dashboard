import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "BNCP 유류 주유 관리",
  description: "Construction Fuel Tracking System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+Bengali:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Pretendard 폴백 (한글 본문 가독성) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="font-sans">
        <I18nProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
