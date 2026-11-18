import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, SidebarInset } from '../ui/shadcn-sidebar';
import styles from './Layout.module.css';

interface LayoutProps {
    children: React.ReactNode;
    title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Dashboard' }) => {
    return (
        <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full">
                <Sidebar isOpen={true} />
                <SidebarInset className="flex flex-col flex-1">
                    <Header title={title} />
                    <main className={styles.content} style={{ flex: 1, backgroundColor: 'var(--color-bg-body)' }}>
                        {children}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};

export default Layout;
