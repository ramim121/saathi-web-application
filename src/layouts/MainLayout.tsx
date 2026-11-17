import React from 'react';
import AppContextProvider from '@/context/AppContext';
import AppShell from './AppShell';

/**
 * Every admin page's frame. The navy header bar and the gradient footer it
 * used to render were replaced on 2026-11-17 by the app shell (sidebar, top
 * bar), the first step of the admin redesign. Pages are unchanged inside it.
 */
interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <AppContextProvider>
            <AppShell>{children}</AppShell>
        </AppContextProvider>
    );
};

export default MainLayout;
