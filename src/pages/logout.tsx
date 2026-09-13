/* eslint-disable react-hooks/exhaustive-deps */
import React, { useContext, useEffect } from "react";
import { useRouter } from 'next/router';
import { AppContext } from "@/context/AppContext";
import Cookies from "js-cookie";
import MainLayout from "@/layouts/MainLayout";

function Logout() {
	const { token, currentUser, updateUserInfo } = useContext(AppContext);
	const router = useRouter();

	useEffect(() => {
		Cookies.remove('saathi-token');
		updateUserInfo(undefined);
		router.push('/login');
	}, []);
}

export default Logout

Logout.getLayout = function PageLayout(page: any) {
	return (
		<MainLayout>
			{page}
		</MainLayout>
	)
}