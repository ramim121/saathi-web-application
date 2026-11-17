import localFont from 'next/font/local';

/**
 * Inter (variable, latin) for the redesigned screens.
 *
 * Self-hosted from the @fontsource-variable/inter package rather than
 * next/font/google: a Google Fonts fetch at build time is a network dependency
 * of every deploy, and on 2026-11-17 Google's intermittent extension-less font
 * URLs failed a website build on this same server. One preloaded woff2, with
 * size-adjusted fallback metrics so text does not jump when it arrives.
 *
 * Apply `inter.variable` next to the `ui` class; ui.css reads --font-inter.
 */
export const inter = localFont({
    src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    weight: '100 900',
    style: 'normal',
    display: 'swap',
    variable: '--font-inter',
});
