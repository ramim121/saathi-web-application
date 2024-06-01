import { createContext, useState, useEffect } from "react";
import { getCookie } from "@/utils/GetCookie";
import Cookies from "js-cookie";

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
    currentUser: {} as User | {}, // Update the type of currentUser to allow for undefined
    updateToken: (token: string | null) => { },
    updateUserInfo: (user: User | {}) => { }
}

export const AppContext = createContext(defaultValue);

function AppContextProvider(props: React.PropsWithChildren<object>) {
    const [token, setToken] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | {}>({});

    useEffect(() => {
        const token = getCookie('saathi-token');;
        const user = localStorage.getItem('user');
        if (token) {
            setToken(token);
        }
        if (user) {
            setCurrentUser(JSON.parse(user));
        }
    }, []);

    const updateToken = (token: string | null) => {
        if (token !== null) {
            setToken(token);
            Cookies.set("saathi-token", token, { expires: 30 });
        }
        else {
            setToken('');
            Cookies.remove("saathi-token");
        }
    }

    const updateUserInfo = (user: User | {}) => {
        if (Object.keys(user).length !== 0) {
            setCurrentUser(user as User); // Update the type of user to User
            localStorage.setItem('user', JSON.stringify(user));
        }
        else {
            setCurrentUser({});
            localStorage.removeItem('user');
        }
    }

    const value = {
        token: token,
        currentUser,
        updateToken,
        updateUserInfo
    }
    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
}

export default AppContextProvider;