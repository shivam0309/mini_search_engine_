import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './globals.css';

export const metadata = {
  title: {
    default: 'Mini Search Engine',
    template: '%s | Mini Search Engine',
  },
  description: 'A search engine built from scratch with its own crawler, inverted index and BM25 + PageRank ranking.',
  icons: { icon: '/icon.svg' },
};

export const viewport = {
  themeColor: '#FBF0DF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
