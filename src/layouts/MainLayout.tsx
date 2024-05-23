import React from 'react';
import Header from "./Header";
import Footer from "./Footer";
import { Container } from 'react-bootstrap';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <>
            <Header />
            <Container style={{ maxWidth: "1140px", minHeight: "80vh" }}>
                <main id='main-content'>
                    {children}
                </main>
            </Container>
            <Footer />
        </>
    )
}

export default MainLayout;