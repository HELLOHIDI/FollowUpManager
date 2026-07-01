import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { loadCurrentUser } from "@/features/auth/server/load-current-user";
import { CurrentUserProvider } from "@/features/auth/context/current-user-context";

export const metadata: Metadata = {
  title: "FuManager",
  description: "Project follow-up operations manager",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await loadCurrentUser();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <CurrentUserProvider initialState={currentUser}>
            {children}
          </CurrentUserProvider>
        </Providers>
      </body>
    </html>
  );
}
