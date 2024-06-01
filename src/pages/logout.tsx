/* eslint-disable react-hooks/exhaustive-deps */
import React, {useContext, useEffect} from "react";
import { useRouter } from 'next/router';
import { AppContext } from "@/context/AppContext";

function Logout (){
    const {token, currentUser,updateToken, updateUserInfo} = useContext(AppContext);
    const router = useRouter();

    useEffect(() => {
    updateToken(null);
    updateUserInfo({});
    router.push('/login');
    }, []);
    return (
        <></>
    )
}

export default Logout