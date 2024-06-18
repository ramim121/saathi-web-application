import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/style.css';
import '../styles/layout.css';
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