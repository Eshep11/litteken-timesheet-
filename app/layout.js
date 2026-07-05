import "./globals.css";

export const metadata = {
  title: "Litteken Plumbing — Time Sheets",
  description: "Weekly employee time sheets for Litteken Plumbing Co., Inc.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
