/* eslint-disable react-hooks/exhaustive-deps */
import { createContext, useState, useEffect } from "react";
import { getCookie } from "@/utils/GetCookie";
import { useRouter } from 'next/router';
import { jwtDecode } from "jwt-decode";

export interface User {
	idUsers: number;
	fullName: string;
	email: string;
	phoneNumber: string;
	profileImage: string;
	userType: string;
}

interface AppContextType {
	token: string | null;
	currentUser: User | undefined;
	updateUserInfo: (user: User | undefined) => void;
}

const defaultValue: AppContextType = {
	token: null,
	currentUser: undefined,
	updateUserInfo: () => { }, // Provide an empty function by default
};

export const AppContext = createContext<AppContextType>(defaultValue);

const AppContextProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
	const [token, setToken] = useState<string | null>(null);
	const [currentUser, setCurrentUser] = useState<User | undefined>(undefined);
	const router = useRouter();

	useEffect(() => {
		const tokenFromCookie = getCookie('saathi-token'); // Renamed to avoid shadowing the 'token' variable
		if (tokenFromCookie) {
			setToken(tokenFromCookie);
			try {
				const decodedUser = jwtDecode<User>(tokenFromCookie);
				setCurrentUser(decodedUser); // Ensure jwtDecode returns the User object correctly.
			} catch (error) {
				console.error("Invalid token format", error);
			}
		} else {
			router.push('/login'); // Redirect if no token
		}
	}, [router]);

	const updateUserInfo = (user: User | undefined) => {
		if (user) {
			setCurrentUser(user);
			localStorage.setItem('user', JSON.stringify(user));
		} else {
			setCurrentUser(undefined);
			localStorage.removeItem('user');
		}
	};

	const value = {
		token,
		currentUser,
		updateUserInfo,
	};

	return (
		<AppContext.Provider value={value}>
			{children}
		</AppContext.Provider>
	);
};

export default AppContextProvider;
