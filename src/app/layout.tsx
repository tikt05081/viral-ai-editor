import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Viral AI Editor — AI video editor for TikTok-style edits',
  description:
    'Paste a TikTok URL or drop in your clips. Our AI copies the style and edits your video like a viral hit. Free, in-browser, no upload.',
  keywords: ['video editor', 'AI video editor', 'TikTok', 'viral edits', 'auto edit', 'beat sync'],
  authors: [{ name: 'Viral AI Editor' }],
  openGraph: {
    title: 'Viral AI Editor',
    description: 'AI video editor that copies the style of any viral TikTok.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viral AI Editor',
    description: 'AI video editor that copies the style of any viral TikTok.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  'glass-strong rounded-2xl text-foreground border-border apple-shadow-lg text-sm',
                description: 'text-muted-foreground',
                actionButton: 'bg-primary text-primary-foreground',
                cancelButton: 'bg-muted text-muted-foreground',
              },
            }}
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
