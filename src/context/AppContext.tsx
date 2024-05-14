import { useState, createContext, ReactNode, useEffect } from 'react';

interface UserData {
    idUsers: number;
    fullName: string;
    profileImage: string;
    email: string;
    phoneNumber: string;
    userType: string;
}

interface AppContextProps {
    token: string | null;
    userInfo: UserData | null;
    updateUserInfo: (userInfoData: UserData | null) => void;
    updateToken: (tokenData: string | null) => void;
}

export const AppContext = createContext<AppContextProps | null>(null);

interface AppContextProviderProps {
    children: ReactNode;
}

function AppContextProvider({ children }: AppContextProviderProps) {

    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        setToken(storedToken);
        const storedUserInfo = localStorage.getItem('userInfo');
        setUserInfo(storedUserInfo ? JSON.parse(storedUserInfo) : null);
    }, []);

    const updateUserInfo = (userInfoData: UserData | null) => {
        setUserInfo(userInfoData);
        if (userInfoData) {
            localStorage.setItem("userInfo", JSON.stringify(userInfoData));
        } else {
            localStorage.removeItem("userInfo");
        }
    };


    const updateToken = (tokenData: string | null) => {
        setToken(tokenData);
        if (tokenData) {
            localStorage.setItem("token", tokenData);
        } else {
            localStorage.removeItem("token");
        }
    };

    return (
        <AppContext.Provider value={{ userInfo: userInfo, token: token, updateUserInfo: updateUserInfo, updateToken: updateToken }}>
            {children}
        </AppContext.Provider>
    );
}