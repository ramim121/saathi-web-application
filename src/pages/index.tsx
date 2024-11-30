import { NextPage } from 'next'
import { Montserrat } from 'next/font/google'
import { useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '@/layouts/MainLayout';
import notification from '@/notifications';


const montserrat = Montserrat({ subsets: ['cyrillic-ext'] })

interface HomeProps {
	getLayout(page: React.ReactNode): React.ReactNode;

}

export default function Home(HomeProps: NextPage) {
	const router = useRouter();
	const [seachText, setSearchText] = useState('');
	return (
		<>
			<h1>WELCOME HOME</h1>
		</>
	)
}

export async function getServerSideProps() {
	notification();
	return {
		props: {
		}
	};
}


Home.getLayout = function getLayout(page: React.ReactNode) {
	return (
		<MainLayout>
			{page}
		</MainLayout>
	)
}