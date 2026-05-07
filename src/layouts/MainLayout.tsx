import React from 'react';
import Header from "./Header";
import Footer from "./Footer";
import { Container } from 'react-bootstrap';
import AppContextProvider from '@/context/AppContext';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <>
            <AppContextProvider>
                <Header />
                <Container fluid className="px-3 px-md-4 px-xl-5" style={{ minHeight: "80vh" }}>
                    <main id='main-content'>
                        {children}
                    </main>
                </Container>
                <Footer />
            </AppContextProvider>
        </>
    )
}

export default MainLayout;