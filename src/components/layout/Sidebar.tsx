import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    Boxes,
    Tag,
    Users,
    ShoppingCart,
    FileText,
    Award,
    CreditCard,
    DollarSign,
    Settings as SettingsIcon,
    ChevronDown,
    UtensilsCrossed,
    Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useOperationMode } from '../../hooks/useOperationMode';
import {
    Sidebar as ShadcnSidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar as useShadcnSidebar,
} from '../ui/shadcn-sidebar';
import { cn } from '../../lib/utils';

interface SidebarProps {
    isOpen: boolean;
}

function SidebarComponent() {
    const { user, signOut } = useAuth();
    const { currentTenant } = useTenant();
    const { showTables } = useOperationMode();
    const [userOpen, setUserOpen] = useState(false);
    const userRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const fullName = (user as any)?.user_metadata?.full_name?.trim();
    const { setOpenMobile } = useShadcnSidebar();

    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            if (userRef.current && !userRef.current.contains(e.target as Node)) {
                setUserOpen(false);
            }
        }

        document.addEventListener('mousedown', handleDocClick);
        return () => document.removeEventListener('mousedown', handleDocClick);
    }, []);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const handleNavClick = () => {
        if (window.innerWidth <= 768) {
            setOpenMobile(false);
        }
    };

    // Build menu items - always render all items to prevent layout shift
    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Inicio', show: true },
        { path: '/pos', icon: CreditCard, label: 'Punto de Venta', show: true },
        { path: '/tables', icon: UtensilsCrossed, label: 'Mesas', show: showTables },
        { path: '/personal', icon: Users, label: 'Personal', show: showTables },
        { path: '/cash-register', icon: DollarSign, label: 'Caja', show: true },
        { path: '/products', icon: Package, label: 'Productos', show: true },
        { path: '/inventory', icon: Boxes, label: 'Inventario', show: true },
        { path: '/categories', icon: Tag, label: 'Categorías', show: true },
        { path: '/brands', icon: Award, label: 'Marcas', show: true },
        { path: '/customers', icon: Users, label: 'Clientes', show: true },
        { path: '/orders', icon: ShoppingCart, label: 'Órdenes', show: true },
        { path: '/fiscal-documents', icon: FileText, label: 'Comprobantes', show: true },
        { path: '/payment-methods', icon: Wallet, label: 'Métodos de Pago', show: true },
        { path: '/settings', icon: SettingsIcon, label: 'Configuración', show: true },
    ];

    return (
        <ShadcnSidebar collapsible="offcanvas" className="border-r" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
            <SidebarHeader className="border-b" style={{ height: '70px', minHeight: '70px', maxHeight: '70px', backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center px-6 h-full">
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        {currentTenant?.name || 'Mi Empresa'}
                    </h1>
                </div>
            </SidebarHeader>
            <SidebarContent style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <SidebarGroup className="py-2">
                    <SidebarGroupContent>
                        <SidebarMenu className="px-3 space-y-1">
                            {menuItems.map((item) => (
                                <SidebarMenuItem 
                                    key={item.path}
                                    style={{
                                        display: item.show ? undefined : 'none'
                                    }}
                                >
                                    <NavLink
                                        to={item.path}
                                        onClick={handleNavClick}
                                    >
                                        {({ isActive }) => (
                                            <SidebarMenuButton
                                                tooltip={item.label}
                                                isActive={isActive}
                                                className={cn(
                                                    "w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded-md",
                                                    isActive 
                                                        ? "text-white hover:bg-[#1e3a8a]/90" 
                                                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                                                )}
                                                style={isActive ? { backgroundColor: '#1e3a8a', color: 'white' } : {}}
                                            >
                                                <item.icon className="h-5 w-5" />
                                                <span>{item.label}</span>
                                            </SidebarMenuButton>
                                        )}
                                    </NavLink>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t p-4" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div ref={userRef} className="relative">
                            <SidebarMenuButton
                                onClick={() => setUserOpen((s) => !s)}
                                className="w-full hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg p-3 min-h-[60px]"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium leading-none text-gray-900 dark:text-gray-100 truncate">
                                        {fullName || 'Usuario'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1.5 truncate">
                                        {user?.email}
                                    </div>
                                </div>
                                <ChevronDown
                                    className={cn(
                                        'h-4 w-4 text-gray-500 dark:text-gray-500 transition-transform duration-200 flex-shrink-0',
                                        userOpen && 'rotate-180'
                                    )}
                                />
                            </SidebarMenuButton>
                            {userOpen && (
                                <div
                                    className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={handleLogout}
                                        className="w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors"
                                    >
                                        Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </ShadcnSidebar>
    );
}

const Sidebar: React.FC<SidebarProps> = () => {
    return <SidebarComponent />;
};

export default Sidebar;
