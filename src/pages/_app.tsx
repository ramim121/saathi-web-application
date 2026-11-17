import 'bootstrap/dist/css/bootstrap.min.css';
/*
 * Loaded between Bootstrap and the page sheets: it redefines Bootstrap's own
 * custom properties, so it must come after Bootstrap, and the older per-page
 * rules must still be able to win over it, so it comes before them.
 */
import '../styles/admin-theme.css';
import '../styles/style.css';
import '../styles/layout.css';
import '../styles/timeline.css';
/*
 * Redesigned screens (Tailwind, prefixed `tw-`). Last, so its scoped reset wins
 * over Bootstrap's reboot inside `.ui` — and it matches nothing outside `.ui`.
 */
import '../styles/ui.css';
import { AppProps } from "next/app"

export default function App({ Component, pageProps }: AppProps) {
	//ignore error next line
	// @ts-ignore
	if (Component.getLayout) {
		// @ts-ignore
		return Component.getLayout(<Component {...pageProps} />)
	}

	return (
		<Component {...pageProps} />
	)
}