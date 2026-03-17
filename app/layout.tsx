import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Compass",
  description:
    "Descubra sua carreira em TI com um sistema especialista baseado em regras, com explicação do raciocínio."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

