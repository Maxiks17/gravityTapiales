import { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import StatCard from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import FadeIn from '../components/ui/FadeIn';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { productService, type Product } from '../services/productService';
import { customerService } from '../services/customerService';
import { type Order } from '../services/orderService';
import { useStockControl } from '../hooks/useStockControl';
import { supabase } from '../services/supabaseClient';
import {
    Package,
    Users,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    AlertTriangle,
    CreditCard,
    FileText,
    Eye,
    EyeOff
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [totalProducts, setTotalProducts] = useState(0);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [monthOrdersCount, setMonthOrdersCount] = useState(0);
    const [monthOrdersAmount, setMonthOrdersAmount] = useState(0);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    const [showSalesAmount, setShowSalesAmount] = useState(false);
    const [topProducts, setTopProducts] = useState<Array<{product: Product, totalQuantity: number}>>([]);
    const { controlStock } = useStockControl();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // Cargar productos con stock real del inventario
            const products = await productService.getAllWithRealStock();
            setTotalProducts(products.length);

            // Productos con stock bajo (menos del 20% del mínimo recomendado)
            const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock_quantity || 10) * 0.5);
            setLowStockProducts(lowStock.slice(0, 5)); // Top 5

            // Cargar clientes
            const customers = await customerService.getAll();
            setTotalCustomers(customers.length);

            // Calcular rango del mes actual
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

            // Contar pedidos del mes actual usando RPC
            const { data: ordersCountData, error: countError } = await supabase
                .rpc('get_month_orders_count', {
                    start_date: firstDayOfMonth.toISOString(),
                    end_date: lastDayOfMonth.toISOString()
                });

            if (countError) {
                console.error('Error counting orders:', countError);
            } else {
                setMonthOrdersCount(ordersCountData || 0);
            }

            // Sumar ventas del mes actual usando RPC (sin límite de 1000)
            const { data: salesTotal, error: sumError } = await supabase
                .rpc('get_month_sales_total', {
                    start_date: firstDayOfMonth.toISOString(),
                    end_date: lastDayOfMonth.toISOString()
                });

            if (sumError) {
                console.error('Error summing orders:', sumError);
            } else {
                setMonthOrdersAmount(salesTotal || 0);
            }

            // Últimas 5 órdenes (solo traer las necesarias)
            const { data: recentOrdersData, error: recentError } = await supabase
                .from('orders')
                .select('*, customer:customers(*)')
                .order('order_date', { ascending: false })
                .limit(5);

            if (recentError) {
                console.error('Error loading recent orders:', recentError);
            } else {
                setRecentOrders(recentOrdersData || []);
            }

            // Top 10 productos más vendidos (solo si control de stock está desactivado)
            try {
                const { data: orderItems, error: itemsError } = await supabase
                    .from('order_items')
                    .select('product_id, quantity, product:products(*)');

                if (!itemsError && orderItems) {
                    // Agrupar por producto y sumar cantidades
                    const productSales = orderItems.reduce((acc: Record<string, { product: Product, totalQuantity: number }>, item: any) => {
                        if (!item.product) return acc;
                        
                        const productId = item.product_id;
                        if (!acc[productId]) {
                            acc[productId] = {
                                product: item.product,
                                totalQuantity: 0
                            };
                        }
                        acc[productId].totalQuantity += item.quantity;
                        return acc;
                    }, {});

                    // Convertir a array y ordenar por cantidad vendida
                    const topProductsArray = Object.values(productSales)
                        .sort((a, b) => b.totalQuantity - a.totalQuantity)
                        .slice(0, 10);

                    setTopProducts(topProductsArray);
                }
            } catch (error) {
                console.error('Error loading top products:', error);
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        {
            title: 'Total Productos',
            value: totalProducts.toString(),
            icon: Package,
            color: 'primary' as const
        },
        {
            title: 'Clientes Activos',
            value: totalCustomers.toString(),
            icon: Users,
            color: 'success' as const
        },
        {
            title: 'Pedidos del Mes',
            value: monthOrdersCount.toString(),
            icon: ShoppingCart,
            color: 'warning' as const
        },
        {
            title: 'Ventas del Mes',
            value: showSalesAmount 
                ? `$${monthOrdersAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '$ ******',
            icon: DollarSign,
            color: 'success' as const,
            showToggle: true,
            toggleIcon: showSalesAmount ? Eye : EyeOff,
            onToggle: () => setShowSalesAmount(!showSalesAmount)
        }
    ];

    if (loading) {
        return (
            <Layout title="Dashboard">
                <LoadingPlaceholder />
            </Layout>
        );
    }

    return (
        <Layout title="Dashboard">
            <FadeIn>
                <div className="dashboard">
                {/* Quick Access Card */}
                <Card style={{ 
                    marginBottom: 'var(--spacing-lg)', 
                    width: '100%'
                }}>
                    <CardHeader>
                        <CardTitle>Accesos Rápidos</CardTitle>
                    </CardHeader>
                    <CardContent style={{ padding: 'var(--spacing-sm) var(--spacing-md) var(--spacing-md)' }}>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                            gap: 'var(--spacing-sm)' 
                        }}>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/pos')}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.375rem', 
                                    height: 'auto', 
                                    padding: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem',
                                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <ShoppingCart size={22} />
                                <span>Punto de Venta</span>
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/cash-register')}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.375rem', 
                                    height: 'auto', 
                                    padding: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem',
                                    background: 'linear-gradient(135deg, var(--color-success) 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <CreditCard size={22} />
                                <span>Caja</span>
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/orders')}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.375rem', 
                                    height: 'auto', 
                                    padding: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem',
                                    background: 'linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <FileText size={22} />
                                <span>Órdenes</span>
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/products')}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.375rem', 
                                    height: 'auto', 
                                    padding: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem',
                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <Package size={22} />
                                <span>Productos</span>
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/customers')}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.375rem', 
                                    height: 'auto', 
                                    padding: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem',
                                    background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <Users size={22} />
                                <span>Clientes</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Statistics Cards */}
                <div className="dashboard-stats">
                    {stats.map((stat, index) => (
                        <StatCard key={index} {...stat} />
                    ))}
                </div>

                {/* Recent Activity */}
                <div className="dashboard-grid">
                    {/* Recent Orders */}
                    <Card className="dashboard-card">
                        <CardHeader>
                            <CardTitle>
                                <div className="card-title-with-icon">
                                    <TrendingUp size={20} />
                                    <span>Ventas Recientes</span>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="dashboard-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Cliente</th>
                                            <th>Monto</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentOrders.length > 0 ? recentOrders.map((order) => (
                                            <tr key={order.id}>
                                                <td className="table-id">{order.order_number}</td>
                                                <td>{order.customer?.business_name || 'Desconocido'}</td>
                                                <td className="table-amount">${order.total_amount.toFixed(2)}</td>
                                                <td>
                                                    <span className={`status-badge status-${order.status.toLowerCase().replace(' ', '-')}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>
                                                    No hay pedidos recientes
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Low Stock Alert or Top Selling Products */}
                    {controlStock ? (
                        <Card className="dashboard-card">
                            <CardHeader>
                                <CardTitle>
                                    <div className="card-title-with-icon">
                                        <AlertTriangle size={20} />
                                        <span>Stock Bajo</span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="low-stock-list">
                                    {lowStockProducts.length > 0 ? lowStockProducts.map((product, index) => (
                                        <div key={index} className="low-stock-item">
                                            <div className="low-stock-info">
                                                <span className="low-stock-name">{product.name}</span>
                                                <span className="low-stock-stock">
                                                    Stock: {product.stock_quantity} / {product.min_stock_quantity || 10}
                                                </span>
                                            </div>
                                            <div className="low-stock-bar">
                                                <div
                                                    className="low-stock-bar-fill"
                                                    style={{ width: `${(product.stock_quantity / (product.min_stock_quantity || 10)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-secondary)' }}>
                                            No hay productos con stock bajo
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="dashboard-card">
                            <CardHeader>
                                <CardTitle>
                                    <div className="card-title-with-icon">
                                        <TrendingUp size={20} />
                                        <span>Top 10 Productos Más Vendidos</span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="dashboard-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th style={{ textAlign: 'right' }}>Cantidad Vendida</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProducts.length > 0 ? topProducts.map((item, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ 
                                                                fontWeight: 'bold', 
                                                                color: 'var(--color-primary)',
                                                                minWidth: '1.5rem'
                                                            }}>
                                                                #{index + 1}
                                                            </span>
                                                            <span>{item.product.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                        {item.totalQuantity} unidades
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={2} style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-secondary)' }}>
                                                        No hay datos de ventas
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Dashboard;
