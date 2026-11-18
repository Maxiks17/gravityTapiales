import { Sun, Moon, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../ui/shadcn-sidebar';
import './Header.css';

interface HeaderProps {
    title: string;
}

const Header = ({ title }: HeaderProps) => {
    const { theme, setTheme } = useTheme();
    const { state, toggleSidebar } = useSidebar();
    const isMobile = window.innerWidth <= 768;

    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <button
                        onClick={toggleSidebar}
                        className="header-action-btn sidebar-toggle-btn"
                        title={state === 'expanded' ? 'Cerrar menú' : 'Abrir menú'}
                    >
                        {isMobile ? (
                            <Menu className="text-[#1e3a8a] dark:text-blue-400" size={20} strokeWidth={2} />
                        ) : state === 'expanded' ? (
                            <ChevronLeft className="text-[#1e3a8a] dark:text-blue-400" size={20} strokeWidth={2} />
                        ) : (
                            <ChevronRight className="text-[#1e3a8a] dark:text-blue-400" size={20} strokeWidth={2} />
                        )}
                    </button>
                    <h2 className="header-title">{title}</h2>
                </div>

                <div className="header-actions">
                    <button
                        className="header-action-btn theme-toggle"
                        title="Cambiar tema"
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
