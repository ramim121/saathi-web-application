import 'bootstrap/dist/css/bootstrap.min.css';
/*
 * Loaded between Bootstrap and the page sheets: it redefines Bootstrap's own
 * custom properties, so it must come after Bootstrap, and the older per-page
 * rules must still be able to win over it, so it comes before them.
 */
import '../styles/admin-theme.css';
/*
 * The redesign's look for Bootstrap's own components (modals, tabs,
 * pagination, badges, dialogs…), built with Tailwind. Straight after the
 * theme for the same reason.
 */
import '../styles/skin.css';
import '../styles/style.css';
import '../styles/layout.css';
import '../styles/timeline.css';
/*
 * Redesigned screens (Tailwind, prefixed `tw-`). Last, so its scoped reset wins
 * over Bootstrap's reboot inside `.ui` — and it matches nothing outside `.ui`.
 */
import '../styles/ui.css';
import type { AppProps } from 'next/app';
import type { ReactElement, ReactNode } from 'react';
import { inter } from '@/ui/font';

type WithLayout = AppProps['Component'] & { getLayout?: (page: ReactElement) => ReactNode };

export default function App({ Component, pageProps }: AppProps) {
	const getLayout = (Component as WithLayout).getLayout ?? ((page: ReactElement) => page);
	return (
		<>
			{/*
			 * Inter for the whole admin. Defined on :root (not a wrapper class)
			 * because modals and SweetAlert dialogs render outside the page tree;
			 * admin-theme.css points Bootstrap's body font at this variable.
			 */}
			<style jsx global>{`
				:root {
					--font-inter: ${inter.style.fontFamily};
				}
			`}</style>
			{getLayout(<Component {...pageProps} />)}
		</>
	);
}
