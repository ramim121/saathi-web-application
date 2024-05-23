//import '@/styles/globals.css'
import 'bootstrap/dist/css/bootstrap.min.css';
// import Header from "@/components/Header"
// import Footer from "@/components/Footer"
// import '../styles/bootstrap.min.css'
// import '../styles/font-awesome.min.css'
import '../styles/style.css';
import '../styles/layout.css';

// import "@fortawesome/fontawesome-svg-core/styles.css";
// import { config } from "@fortawesome/fontawesome-svg-core";
// // Tell Font Awesome to skip adding the CSS automatically 
// // since it's already imported above
// config.autoAddCss = false;

import { AppProps } from "next/app"
import { Container } from 'react-bootstrap';

export default function App({ Component, pageProps }: AppProps) {
	const siteId = 3815390;
	const hotjarVersion = 6;


	//ignore error next line
	// @ts-ignore
	if (Component.getLayout) {
		// @ts-ignore
		return Component.getLayout(<Component {...pageProps} />)
	}

	return (
		<>
			{/* <Header /> */}
			<Component {...pageProps} />
			{/* <Footer /> */}
		</>

	)
}