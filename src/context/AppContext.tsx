import { createContext, useState, useEffect } from "react";

export interface User {
    idUsers: number,
    fullName: string,
    email: string,
    phoneNumber: string,
    profileImage: string,
    userType: string
}

const defaultValue = {
    token: '',
    currentUser: undefined as User | undefined,
    updateToken: (token: string) => { },
    updateUserInfo: (user: User) => { }
}

export const AppContext = createContext(defaultValue);

function AppContextProvider(props: React.PropsWithChildren<object>) {
    const [token, setToken] = useState<string>('');
    const [currentUser, setCurrentUser] = useState<User | undefined>(undefined);

    useEffect(() => {
        const token = localStorage.getItem('token');
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
            localStorage.setItem('token', token);
        }
        else {
            setToken('');
            localStorage.removeItem('token');
        }
    }

    const updateUserInfo = (user: User | null) => {
        if (user !== null) {
            setCurrentUser(user);
            localStorage.setItem('user', JSON.stringify(user));
        }
        else {
            setCurrentUser(undefined);
            localStorage.removeItem('user');
        }
    }

    const value = {
        token,
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