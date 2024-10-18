/* eslint-disable react-hooks/exhaustive-deps */
import { createContext, useState, useEffect } from "react";
import { getCookie } from "@/utils/GetCookie";
import { useRouter } from 'next/router';
import { jwtDecode } from "jwt-decode";

export interface User {
	idUsers: number,
	fullName: string,
	email: string,
	phoneNumber: string,
	profileImage: string,
	userType: string
}

const defaultValue = {
	token: null as string | null,
	currentUser: undefined as User | undefined,
	updateUserInfo: (user: User | undefined) => { }
}

export const AppContext = createContext(defaultValue);

function AppContextProvider(props: React.PropsWithChildren<object>) {
	const [token, setToken] = useState<string | null>(null);
	const [currentUser, setCurrentUser] = useState<User | undefined>(undefined);
	const router = useRouter(); // Get the router instance

	useEffect(() => {
		const token = getCookie('saathi-token');
		if (token) {
			setToken(token);
		}
		else {
			router.push('/login'); // Redirect to login page if no token
		}
		if (token) {
			setCurrentUser(jwtDecode(token));
		}
	}, []);

	const updateUserInfo = (user: User | undefined) => {
		if (user !== undefined) {
			setCurrentUser(user as User); // Update the type of user to User
			localStorage.setItem('user', JSON.stringify(user));
		}
		else {
			setCurrentUser(undefined);
			localStorage.removeItem('user');
		}
	}

	const value = {
		token: token,
		currentUser,
		updateUserInfo
	}
	return (
		<AppContext.Provider value={value}>
			{props.children}
		</AppContext.Provider>
	);
}

export default AppContextProvider;