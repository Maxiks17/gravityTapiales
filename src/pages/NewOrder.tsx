import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { customerService, type Customer } from '../services/customerService';
import { productService, type Product } from '../services/productService';
import { Button } from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import Layout from '../components/layout/Layout';
import { useToast } from '../context/ToastContext';
import { useStockControl } from '../hooks/useStockControl';
import styles from './NewOrder.module.css';
import { supabase } from '../services/supabaseClient';

interface OrderItem {
    product: Product;
    quantity: number;
}

const NewOrder: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { controlStock } = useStockControl();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [customersData, productsData] = await Promise.all([
                customerService.getAll(),
                productService.getAllWithRealStock()
            ]);
            setCustomers(customersData);
            setProducts(productsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku?.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 5);
    }, [products, productSearch]);

    const handleAddProduct = (product: Product) => {
        setOrderItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                const newQuantity = existing.quantity + 1;
                
                // Check stock if stock control is enabled
                if (controlStock && newQuantity > product.stock_quantity) {
                    showToast(`Stock insuficiente. Stock disponible: ${product.stock_quantity}`, 'error');
                    return prev;
                }
                
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: newQuantity }
                        : item
                );
            }
            
            // Check stock for new items if stock control is enabled
            if (controlStock && product.stock_quantity < 1) {
                showToast(`Stock insuficiente. Stock disponible: ${product.stock_quantity}`, 'error');
                return prev;
            }
            
            return [...prev, { product, quantity: 1 }];
        });
        setProductSearch('');
    };

    const updateQuantity = (productId: string, delta: number) => {
        setOrderItems(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQuantity = Math.max(0, item.quantity + delta);
                
                // Check stock if increasing quantity and stock control is enabled
                if (controlStock && delta > 0 && newQuantity > item.product.stock_quantity) {
                    showToast(`Stock insuficiente. Stock disponible: ${item.product.stock_quantity}`, 'error');
                    return item;
                }
                
                return { ...item, quantity: newQuantity };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeItem = (productId: string) => {
        setOrderItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const subtotal = orderItems.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
    const total = subtotal;

    const handleSubmit = async () => {
        if (!selectedCustomerId || orderItems.length === 0) return;

        // Check stock before creating order if stock control is enabled
        if (controlStock) {
            for (const item of orderItems) {
                if (item.quantity > item.product.stock_quantity) {
                    showToast(`Stock insuficiente para ${item.product.name}. Stock disponible: ${item.product.stock_quantity}`, 'error');
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            // Generar número de orden autoincremental
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true });

            const orderNumber = ((count || 0) + 1).toString();

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    order_number: orderNumber,
                    customer_id: selectedCustomerId,
                    order_date: new Date().toISOString(),
                    status: 'pending',
                    subtotal: subtotal,
                    total_amount: total
                })
                .select()
                .single();

            if (orderError) {
                console.error('Order creation error:', orderError);
                throw orderError;
            }

            const itemsToInsert = orderItems.map(item => ({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.sale_price,
                discount_percentage: 0,
                discount_amount: 0,
                subtotal: item.product.sale_price * item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

            if (itemsError) {
                console.error('Order items error:', itemsError);
                showToast(`Error inserting items: ${itemsError.message}`, 'error');
                throw itemsError;
            }

            showToast('Order created successfully!', 'success');
            setTimeout(() => navigate('/orders'), 1000);
        } catch (error: any) {
            console.error('Error creating order:', error);
            showToast(error?.message || 'Failed to create order. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Layout title="Nuevo Pedido">
            <div className={styles.container}>
                {controlStock && (
                    <div style={{ 
                        padding: '8px 16px', 
                        backgroundColor: 'var(--color-primary)', 
                        color: 'white', 
                        fontSize: '0.85rem', 
                        borderRadius: '4px', 
                        marginBottom: '16px',
                        textAlign: 'center'
                    }}>
                        ✓ Control de stock activado
                    </div>
                )}
                {/* Order Summary como subheader en móvil */}
                <div className={styles.summarySubheader}>
                    <h2 className={styles.sectionTitle}>Resumen del Pedido</h2>
                    <div className={styles.summary}>
                        <div className={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className={styles.summaryTotal}>
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <Button
                            variant="primary"
                            style={{ width: '100%' }}
                            onClick={handleSubmit}
                            disabled={!selectedCustomerId || orderItems.length === 0 || isSubmitting}
                            isLoading={isSubmitting}
                        >
                            Crear Pedido
                        </Button>
                    </div>
                </div>

                <div className={styles.grid}>
                    <div className={styles.mainContent}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>1. Seleccionar Cliente</h2>
                            <div className={styles.clientSelect}>
                                <label className={styles.label}>Cliente</label>
                                <select
                                    className={styles.select}
                                    value={selectedCustomerId}
                                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                                >
                                    <option value="">Selecciona un cliente...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.business_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. Agregar Productos</h2>
                            <div className={styles.productSearch}>
                                <SearchBar
                                    value={productSearch}
                                    onChange={setProductSearch}
                                    placeholder="Buscar productos por nombre o SKU..."
                                />
                            </div>

                            {productSearch && (
                                <div className={styles.productList}>
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className={styles.productItem}>
                                            <div className={styles.productInfo}>
                                                <div className={styles.productName}>{product.name}</div>
                                                <div className={styles.productMeta}>
                                                    SKU: {product.sku || 'Sin SKU'} | Stock: {product.stock_quantity} | ${product.sale_price}
                                                    {controlStock && product.stock_quantity === 0 && (
                                                        <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
                                                            (Sin stock)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                onClick={() => handleAddProduct(product)}
                                                disabled={controlStock && product.stock_quantity === 0}
                                            >
                                                Agregar
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. Artículos del Pedido</h2>
                            {orderItems.length === 0 ? (
                                <div className={styles.emptyState}>
                                    No se han agregado artículos aún. Busca productos arriba.
                                </div>
                            ) : (
                                <div className={styles.orderItems}>
                                    {orderItems.map(item => (
                                        <div key={item.product.id} className={styles.orderItem}>
                                            <div className={styles.itemInfo}>
                                                <span className={styles.itemName}>
                                                    {item.product.name}
                                                    {controlStock && item.quantity > item.product.stock_quantity && (
                                                        <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
                                                            (Excede stock disponible: {item.product.stock_quantity})
                                                        </span>
                                                    )}
                                                </span>
                                                <span className={styles.itemPrice}>${item.product.sale_price} each</span>
                                            </div>
                                            <div className={styles.itemControls}>
                                                <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.product.id, -1)}>
                                                    <Minus size={16} />
                                                </Button>
                                                <span className={styles.quantity}>{item.quantity}</span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                    disabled={controlStock && item.quantity >= item.product.stock_quantity}
                                                >
                                                    <Plus size={16} />
                                                </Button>
                                                <div className={styles.itemTotal}>
                                                    ${(item.product.sale_price * item.quantity).toFixed(2)}
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => removeItem(item.product.id)}>
                                                    <Trash2 size={16} color="var(--color-error)" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Resumen del Pedido</h2>
                            <div className={styles.summary}>
                                <div className={styles.summaryRow}>
                                    <span>Subtotal</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className={styles.summaryTotal}>
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <Button
                                    variant="primary"
                                    style={{ width: '100%' }}
                                    onClick={handleSubmit}
                                    disabled={!selectedCustomerId || orderItems.length === 0 || isSubmitting}
                                    isLoading={isSubmitting}
                                >
                                    Crear Pedido
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default NewOrder;
