import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Leadflow - Acquisition as Infrastructure",
  description: "Shared intelligence and signal layer for B2B SaaS acquisition.",
};

const themeScript = `
(() => {
  try {
    const storageKey = "leadflow-theme";
    const storedTheme = localStorage.getItem(storageKey);
    const validStoredTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const activeTheme = validStoredTheme ?? preferredTheme;
    document.documentElement.classList.toggle("dark", activeTheme === "dark");
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
