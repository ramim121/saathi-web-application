import { NextPage } from 'next'
import { Montserrat } from 'next/font/google'
import { useState } from 'react';
import { useRouter } from 'next/router';




const montserrat = Montserrat({ subsets: ['cyrillic-ext'] })

const Home: NextPage = () => {
	const router = useRouter();
	const [seachText, setSearchText] = useState('');
	return (
		<>
			<main className=''>
				<h1>WELCOME HOME</h1>
			</main >
		</>
	)
}

export default Home;