/**
 * PostCSS for the whole admin: Tailwind, then EXACTLY the pipeline Next.js runs
 * when a project has no PostCSS config of its own.
 *
 * A custom config replaces Next's built-in one wholesale. Dropping it changed
 * how Bootstrap compiled — different vendor prefixes and flexbox output on 140
 * rules of pages that have nothing to do with Tailwind. So the two default
 * plugins are re-declared below with Next's own options, resolved from Next's
 * bundled copies (node_modules/next/dist/compiled), and the browser targets are
 * Next's default list (node_modules/next/dist/shared/lib/
 * modern-browserslist-target.js), used because this project has no browserslist
 * config. Verified on 2026-11-17: every pre-existing CSS rule compiles to the
 * same output as before; the only additions are Tailwind's.
 *
 * Keep this in step if a browserslist config is ever added or Next is upgraded
 * (compare with getDefaultPlugins in next/dist/build/webpack/config/blocks/css/plugins.js).
 *
 * After editing this file, delete `.next/cache` before building: webpack's
 * build cache does not notice a PostCSS config change and will happily reuse
 * CSS compiled under the old one (seen while writing this).
 */
module.exports = {
    plugins: {
        tailwindcss: {},
        'next/dist/compiled/postcss-flexbugs-fixes': {},
        'next/dist/compiled/postcss-preset-env': {
            browsers: ['chrome 64', 'edge 79', 'firefox 67', 'opera 51', 'safari 12'],
            autoprefixer: { flexbox: 'no-2009' },
            stage: 3,
            features: { 'custom-properties': false },
        },
    },
};
