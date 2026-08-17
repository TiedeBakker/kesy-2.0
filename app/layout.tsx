// app/layout.tsx
import Navbar from "@/src/components/Navbar";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="dark h-full">
      {/* h-full en bg-slate-950 zorgen dat HET GEHELE SCHERM donker is, geen witte randen! */}
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Navbar />
        {/* Full-width container met subtiele padding, zonder beperkt smaller 'vak' */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}