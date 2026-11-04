import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Job Radar · Tu próxima oportunidad",
  description:
    "Búsqueda personal de oportunidades de desarrollo remoto desde Argentina.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
