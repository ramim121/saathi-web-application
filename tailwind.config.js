/**
 * Tailwind for the redesigned admin screens.
 *
 * The admin is Bootstrap 5 throughout, and the redesign replaces it one screen
 * at a time. Until the last Bootstrap page is gone, the two must not touch:
 *
 *   - `prefix: 'tw-'` — every utility is `tw-…`, so none can collide with a
 *     Bootstrap class of the same name (`p-3`, `border`, `container`, `badge`
 *     all exist in both, with different values).
 *   - `preflight: false` — Tailwind's global reset would restyle every
 *     Bootstrap page. Redesigned screens get a small reset of their own, scoped
 *     to `.ui` (src/styles/ui.css).
 *
 * When Bootstrap is finally removed, drop the prefix (a codemod) and turn
 * preflight back on.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
    prefix: 'tw-',
    corePlugins: { preflight: false },
    // Scope the --tw-* variable defaults to elements that use them, rather than
    // a `*, ::before, ::after` rule on every element of every (Bootstrap) page.
    experimental: { optimizeUniversalDefaults: true },
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            colors: {
                // The Shathi green already used across the product (admin-theme.css).
                brand: {
                    50: '#eef7f2',
                    100: '#d6ece0',
                    200: '#aed8c2',
                    300: '#7dbd9d',
                    400: '#4c9d77',
                    500: '#2b805b',
                    600: '#0a6b42',
                    700: '#075635',
                    800: '#06442b',
                    900: '#053823',
                },
            },
            boxShadow: {
                card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
                pop: '0 12px 32px -8px rgb(16 24 40 / 0.18)',
            },
        },
    },
    plugins: [],
};
