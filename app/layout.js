import "./globals.css";

export const metadata = {
  title: "EkaGuru · ఏకగురు",
  description: "Connecting students across Telangana and Andhra Pradesh with volunteer career mentors.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
