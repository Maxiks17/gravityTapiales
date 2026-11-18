import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, X, UtensilsCrossed, Printer, CreditCard, Edit2, Scale } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { type Product } from '../services/productService';
import { customerService, type Customer } from '../services/customerService';
import { orderService } from '../services/orderService';
import { tenantService } from '../services/tenantService';
import { tableService } from '../services/tableService';
import { paymentMethodService } from '../services/paymentMethodService';
import { fiscalDocumentService } from '../services/fiscalDocumentService';
import { supabase } from '../services/supabaseClient';
import { useStockControl } from '../hooks/useStockControl';
import { useOperationMode } from '../hooks/useOperationMode';
import { usePOSData } from '../context/POSDataContext';
import { Button } from '../components/ui/Button';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import { taxRateTypeService, type TaxRateType } from '../services/taxRateTypeService';
import { useToast } from '../context/ToastContext';
import { useTenant } from '../context/TenantContext';
import styles from './PointOfSale.module.css';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import type { Table } from '../types/operationMode';
import type { PaymentMethod } from '../types/paymentMethod';
import { Modal } from '../components/ui/Modal';
import { TipoDocumento } from '../services/afip/constants';

interface CartItem {
    product: Product;
    quantity: number;
}

const PointOfSale: React.FC = () => {
        const [taxRateTypes, setTaxRateTypes] = useState<TaxRateType[]>([]);
    const { showToast } = useToast();
    const { controlStock } = useStockControl();
    const { operationMode, customerRequired } = useOperationMode();
    const { products, categories, customers, loading, refreshData, refreshStock } = usePOSData();
    const { currentTenant } = useTenant();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discountPercentInput, setDiscountPercentInput] = useState<string>('');
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);
    const [newCustomerDraft, setNewCustomerDraft] = useState<Partial<Customer>>({
        business_name: '',
        document_type: TipoDocumento.DNI,
        document_number: '',
        contact_name: '',
        phone: '',
        email: '',
    });

    // Restaurant mode specific state
    const [currentTable, setCurrentTable] = useState<Table | null>(null);
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

    // Mixed payments state
    const [paymentAllocations, setPaymentAllocations] = useState<{
        payment_method_id: string;
        amount: number;
    }[]>([]);
    const [customPaymentAmount, setCustomPaymentAmount] = useState<string>('');
    const [paymentMethodsExpanded, setPaymentMethodsExpanded] = useState(false);

    // Custom quantity modal state (for bulk/weighted products)
    const [customQuantityModal, setCustomQuantityModal] = useState<{
        isOpen: boolean;
        product: Product | null;
        quantity: string;
    }>({ isOpen: false, product: null, quantity: '' });
    const customQuantityInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        refreshData();
        loadPaymentMethods();

        // Check if we're coming from a table (restaurant mode)
        const tableId = searchParams.get('table');
        const orderId = searchParams.get('order');

        if (tableId) {
            loadTableAndOrder(tableId, orderId);
        }
    }, []);

    useEffect(() => {
        const loadTaxRateTypes = async () => {
            try {
                const items = await taxRateTypeService.getAll();
                setTaxRateTypes(items);
            } catch (error) {
                console.error('Error loading tax rate types:', error);
                setTaxRateTypes([]);
            }
        };

        loadTaxRateTypes();
    }, []);

    const getTaxRatePercent = (taxRateTypeId: number | null | undefined) => {
        const id = taxRateTypeId ?? 5;
        const type = taxRateTypes.find((t) => t.id === id);
        if (!type) return 0;
        const raw = type.nombre.trim().replace('%', '').replace(',', '.');
        const value = Number.parseFloat(raw);
        return Number.isFinite(value) ? value : 0;
    };

    const loadPaymentMethods = async () => {
        try {
            await paymentMethodService.initFrequencyOrder();
            const methods = await paymentMethodService.getAll();
            setPaymentMethods(methods);
            if (methods.length > 0) {
                setSelectedPaymentMethod(methods[0].id);
            }
        } catch (error) {
            console.error('Error loading payment methods:', error);
        }
    };

    const loadTableAndOrder = async (tableId: string, orderId: string | null) => {
        try {
            const table = await tableService.getById(tableId);
            setCurrentTable(table);

            if (orderId) {
                setCurrentOrderId(orderId);
                // Load existing order items into cart
                const order = await orderService.getById(orderId);
                if (order && order.items) {
                    const cartItems: CartItem[] = order.items.map((item: any) => ({
                        product: item.product,
                        quantity: item.quantity,
                    }));
                    setCart(cartItems);
                    setDiscountPercentInput('');
                }
                // Load customer from order if exists
                if (order && order.customer_id) {
                    setSelectedCustomer(order.customer_id);
                }
            }
        } catch (error) {
            console.error('Error loading table/order:', error);
            showToast('Error al cargar la mesa', 'error');
        }
    };

    // Reload table status when navigating back (detect URL changes)
    useEffect(() => {
        const tableId = searchParams.get('table');
        if (tableId && currentTable && currentTable.id === tableId) {
            // Refresh table status in case it changed
            tableService.getById(tableId).then(updatedTable => {
                if (updatedTable.status !== currentTable.status) {
                    setCurrentTable(updatedTable);
                }
            }).catch(err => console.error('Error refreshing table:', err));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.sku?.toLowerCase()?.includes(searchTerm.toLowerCase()) || false);
            const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    const selectedCustomerData = useMemo(() => {
        return customers.find(customer => customer.id === selectedCustomer) || null;
    }, [customers, selectedCustomer]);

    const filteredCustomersBySearch = useMemo(() => {
        const term = customerSearchTerm.trim().toLowerCase();
        if (!term) return customers.slice(0, 20);

        return customers
            .filter(customer =>
                customer.business_name.toLowerCase().includes(term) ||
                (customer.document_number || '').toLowerCase().includes(term)
            )
            .slice(0, 20);
    }, [customers, customerSearchTerm]);

    const addToCart = (product: Product) => {
        // If product allows custom quantity, show modal instead of adding directly
        if (product.allows_custom_quantity) {
            setCustomQuantityModal({
                isOpen: true,
                product,
                quantity: '1'
            });
            setTimeout(() => customQuantityInputRef.current?.focus(), 100);
            return;
        }

        addToCartWithQuantity(product, 1);
    };

    const addToCartWithQuantity = (product: Product, quantity: number) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.product.id === product.id);
            if (existingItem) {
                const newQuantity = existingItem.quantity + quantity;
                if (controlStock && newQuantity > product.stock_quantity) {
                    showToast('No hay suficiente stock disponible', 'error');
                    return prevCart;
                }
                return prevCart.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: newQuantity }
                        : item
                );
            }

            // Check stock for new items only if stock control is enabled
            if (controlStock && product.stock_quantity < quantity) {
                showToast('No hay suficiente stock disponible', 'error');
                return prevCart;
            }

            return [...prevCart, { product, quantity }];
        });
    };

    const handleCustomQuantityConfirm = () => {
        const { product, quantity } = customQuantityModal;
        if (!product) return;

        const parsedQuantity = parseFloat(quantity.replace(',', '.'));
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            showToast('Ingresa una cantidad válida', 'error');
            return;
        }

        // Check if product already exists in cart (editing existing item)
        const existingItem = cart.find(item => item.product.id === product.id);
        if (existingItem) {
            // Update existing item with new quantity (replace, not add)
            if (controlStock && parsedQuantity > product.stock_quantity) {
                showToast('No hay suficiente stock disponible', 'error');
                return;
            }
            setCart(prevCart => prevCart.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: parsedQuantity }
                    : item
            ));
        } else {
            // Add new item
            addToCartWithQuantity(product, parsedQuantity);
        }
        setCustomQuantityModal({ isOpen: false, product: null, quantity: '' });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product.id === productId) {
                    const newQuantity = item.quantity + delta;
                    if (newQuantity <= 0) return item;
                    if (controlStock && newQuantity > item.product.stock_quantity) {
                        showToast('No hay suficiente stock disponible', 'error');
                        return item;
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prevCart => {
            const newCart = prevCart.filter(item => item.product.id !== productId);
            if (newCart.length === 0) {
                clearPaymentAllocations();
                setDiscountPercentInput('');
            }
            return newCart;
        });
    };

    const clearCart = () => {
        setCart([]);
        setDiscountPercentInput('');
        clearPaymentAllocations();
    };

    const handleSelectCustomer = (customerId: string) => {
        setSelectedCustomer(customerId);
        setIsCustomerModalOpen(false);
        setCustomerSearchTerm('');
        showToast('Cliente seleccionado', 'success');
    };

    const handleCreateCustomerInline = async (e: React.FormEvent) => {
        e.preventDefault();

        const businessName = (newCustomerDraft.business_name || '').trim();
        if (!businessName) {
            showToast('La razón social es obligatoria', 'error');
            return;
        }

        setIsSavingCustomer(true);
        try {
            const payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'> = {
                business_name: businessName,
                is_active: true,
                document_type: Number(newCustomerDraft.document_type || TipoDocumento.DNI),
                document_number: (newCustomerDraft.document_number || '').replace(/\D/g, '').slice(0, 20) || undefined,
                contact_name: (newCustomerDraft.contact_name || '').trim() || undefined,
                phone: (newCustomerDraft.phone || '').trim() || undefined,
                email: (newCustomerDraft.email || '').trim() || undefined,
                condicion_fiscal_id: 0,
            };

            const createdCustomer = await customerService.create(payload);
            await refreshData();
            setSelectedCustomer(createdCustomer.id);
            setIsCustomerModalOpen(false);
            setCustomerSearchTerm('');
            setNewCustomerDraft({
                business_name: '',
                document_type: TipoDocumento.DNI,
                document_number: '',
                contact_name: '',
                phone: '',
                email: '',
            });
            showToast('Cliente creado y seleccionado', 'success');
        } catch (error) {
            console.error('Error creating customer inline:', error);
            showToast('No se pudo crear el cliente', 'error');
        } finally {
            setIsSavingCustomer(false);
        }
    };

    const discountPercent = useMemo(() => {
        const parsed = Number.parseFloat(discountPercentInput.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        return Math.min(parsed, 100);
    }, [discountPercentInput]);

    // El precio de venta YA incluye IVA
    // Total = suma de precios (con IVA incluido)
    const grossTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
    }, [cart]);

    const discountAmount = useMemo(() => {
        if (grossTotal <= 0 || discountPercent <= 0) return 0;
        return (grossTotal * discountPercent) / 100;
    }, [grossTotal, discountPercent]);

    const discountPercentLabel = useMemo(() => {
        return Number.isInteger(discountPercent)
            ? discountPercent.toString()
            : discountPercent.toFixed(2);
    }, [discountPercent]);

    const total = useMemo(() => {
        return Math.max(0, grossTotal - discountAmount);
    }, [grossTotal, discountAmount]);

    // Calcular el subtotal y el IVA desde el total
    const { subtotal, tax } = useMemo(() => {
        let calculatedSubtotal = 0;
        let calculatedTax = 0;

        cart.forEach(item => {
            const itemTotal = item.product.sale_price * item.quantity; // precio con IVA
            const taxRatePercent = getTaxRatePercent(item.product.tax_rate);
            const taxRate = taxRatePercent / 100;
            
            // Subtotal = Total / (1 + tasa_iva)
            const itemSubtotal = itemTotal / (1 + taxRate);
            // IVA = Total - Subtotal
            const itemTax = itemTotal - itemSubtotal;
            
            calculatedSubtotal += itemSubtotal;
            calculatedTax += itemTax;
        });

        if (grossTotal <= 0) {
            return { subtotal: 0, tax: 0 };
        }

        const ratio = total / grossTotal;

        return {
            subtotal: calculatedSubtotal * ratio,
            tax: calculatedTax * ratio
        };
    }, [cart, taxRateTypes, getTaxRatePercent, grossTotal, total]);

    const ticketItemsForPrint = useMemo(() => {
        const items = cart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.sale_price
        }));

        if (discountAmount > 0) {
            items.push({
                name: 'Descuento',
                quantity: 1,
                price: -discountAmount
            });
        }

        return items;
    }, [cart, discountAmount]);

    // Mixed payments calculations
    const totalAllocated = useMemo(() => {
        return paymentAllocations.reduce((sum, p) => sum + p.amount, 0);
    }, [paymentAllocations]);

    const paymentDifference = useMemo(() => {
        return total - totalAllocated;
    }, [total, totalAllocated]);

    const remainingAmount = useMemo(() => {
        return Math.max(0, paymentDifference);
    }, [paymentDifference]);

    const isPaymentComplete = useMemo(() => {
        return paymentAllocations.length > 0 && Math.abs(paymentDifference) < 0.01;
    }, [paymentDifference, paymentAllocations]);

    useEffect(() => {
        const roundAmount = (value: number) => Math.round(value * 100) / 100;

        setPaymentAllocations(prev => {
            if (prev.length === 0) return prev;

            const allocated = roundAmount(prev.reduce((sum, item) => sum + item.amount, 0));
            let excess = roundAmount(allocated - total);

            if (excess <= 0.01) return prev;

            const adjusted = [...prev];

            for (let index = adjusted.length - 1; index >= 0 && excess > 0; index -= 1) {
                const current = roundAmount(adjusted[index].amount);
                const reduceBy = Math.min(current, excess);
                adjusted[index] = {
                    ...adjusted[index],
                    amount: roundAmount(current - reduceBy),
                };
                excess = roundAmount(excess - reduceBy);
            }

            return adjusted.filter(item => item.amount > 0.009);
        });
    }, [total]);

    const hasAutoInvoicePayment = useMemo(() => {
        return paymentAllocations.some(p => {
            const method = paymentMethods.find(m => m.id === p.payment_method_id);
            return method?.auto_invoice;
        });
    }, [paymentAllocations, paymentMethods]);

    const addPaymentAllocation = (methodId: string, amount: number) => {
        if (amount <= 0) return;
        setPaymentAllocations(prev => {
            const existing = prev.find(p => p.payment_method_id === methodId);
            if (existing) {
                return prev.map(p =>
                    p.payment_method_id === methodId
                        ? { ...p, amount: p.amount + amount }
                        : p
                );
            }
            return [...prev, { payment_method_id: methodId, amount }];
        });
        setCustomPaymentAmount('');
    };

    const removePaymentAllocation = (methodId: string) => {
        setPaymentAllocations(prev => prev.filter(p => p.payment_method_id !== methodId));
    };

    const clearPaymentAllocations = () => {
        setPaymentAllocations([]);
        setCustomPaymentAmount('');
    };

    const getPaymentAmount = (): number => {
        const custom = parseFloat(customPaymentAmount);
        if (!isNaN(custom) && custom > 0) {
            return Math.min(custom, remainingAmount);
        }
        return remainingAmount;
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            showToast('El carrito está vacío', 'error');
            return;
        }

        if (paymentAllocations.length === 0) {
            showToast('Agrega al menos un método de pago', 'error');
            return;
        }

        if (!isPaymentComplete) {
            if (paymentDifference > 0.01) {
                showToast(`Faltan $${paymentDifference.toFixed(2)} por asignar`, 'error');
            } else {
                showToast(`Hay $${Math.abs(paymentDifference).toFixed(2)} de más asignado`, 'error');
            }
            return;
        }

        // Validate customer for DISTRIBUIDOR mode
        if (customerRequired && !selectedCustomer) {
            showToast('Debe seleccionar un cliente para modo Distribuidor', 'error');
            setIsCustomerModalOpen(true);
            return;
        }

        // Validar stock antes de procesar si está habilitado el control
        if (controlStock) {
            for (const item of cart) {
                if (item.quantity > item.product.stock_quantity) {
                    showToast(`No hay suficiente stock de ${item.product.name}. Stock disponible: ${item.product.stock_quantity}`, 'error');
                    return;
                }
            }
        }

        setIsProcessing(true);
        try {
            // Si no hay cliente seleccionado, buscar el cliente ANONIMO
            let customerId = selectedCustomer;
            if (!customerId && !customerRequired) {
                const anonymousCustomer = customers.find(c =>
                    c.business_name.toUpperCase() === 'ANONIMO' ||
                    c.business_name.toUpperCase() === 'ANÓNIMO'
                );
                if (anonymousCustomer) {
                    customerId = anonymousCustomer.id;
                }
            }

            const orderItems = cart.map(item => {
                const itemTotal = item.product.sale_price * item.quantity; // precio con IVA incluido
                const taxRatePercent = getTaxRatePercent(item.product.tax_rate);
                const taxRate = taxRatePercent / 100;
                // Subtotal = Total / (1 + tasa_iva)
                const itemSubtotal = itemTotal / (1 + taxRate);
                
                return {
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.sale_price,
                    subtotal: itemSubtotal
                };
            });

            // Determine effective operation mode:
            // If RESTAURANTE but no table, treat as KIOSCO (complete immediately)
            const effectiveMode = (operationMode === 'RESTAURANTE' && !currentTable)
                ? 'KIOSCO'
                : operationMode;

            // Create order with mixed payments
            const createdOrder = await orderService.createByMode(
                {
                    customer_id: customerId || null,
                    table_id: currentTable?.id || null,
                    payments: paymentAllocations,
                    items: orderItems,
                    subtotal: subtotal,
                    tax_amount: tax,
                    total_amount: total,
                    discount_amount: discountAmount,
                    discount_percent: discountPercent,
                },
                effectiveMode
            );

            let generatedFdocNumber: string | null = null;

            // If any payment method has auto_invoice, create fiscal document
            if (hasAutoInvoicePayment) {
                try {
                    // Ensure we have a customer_id for the fiscal document
                    let fiscalCustomerId = customerId;

                    if (!fiscalCustomerId) {
                        // Find ANONIMO customer if not already set
                        const anonymousCustomer = customers.find(c =>
                            c.business_name.toUpperCase() === 'ANONIMO' ||
                            c.business_name.toUpperCase() === 'ANÓNIMO'
                        );

                        if (anonymousCustomer) {
                            fiscalCustomerId = anonymousCustomer.id;
                        } else {
                            throw new Error('No se encontró cliente para la factura. Debe existir un cliente ANONIMO.');
                        }
                    }

                    generatedFdocNumber = `FDOC-${Date.now()}`;
                    await fiscalDocumentService.create({
                        customer_id: fiscalCustomerId,
                        order_id: createdOrder.id,
                        fdoc_number: generatedFdocNumber,
                        fdoc_date: new Date().toISOString(),
                        total_amount: total,
                        status: 'pending'
                    });
                    showToast('¡Pedido completado y factura generada!', 'success');
                } catch (fiscalError) {
                    console.error('Error creating fiscal document:', fiscalError);
                    showToast('Pedido completado pero hubo un error al generar la factura', 'error');
                }
            } else {
                const modeMessages = {
                    KIOSCO: '¡Pedido completado exitosamente!',
                    DISTRIBUIDOR: '¡Pedido creado! Pendiente de entrega.',
                    RESTAURANTE: '¡Pedido completado exitosamente!',
                };
                showToast(modeMessages[operationMode], 'success');
            }

            // Verificar si debe imprimir automáticamente
            try {
                if (currentTenant) {
                    const settings = await tenantService.getSettings(currentTenant.id);
                    const autoPrint = settings.auto_print_pos === 'true' || settings.auto_print_pos === true;
                    const printSeparateByCategory = settings.print_separate_by_category === 'true' || settings.print_separate_by_category === true;
                    if (autoPrint) {
                        const printEndpoint = settings.print_endpoint;
                        if (printEndpoint) {
                            let ticketCount = 0;

                            // 1. Siempre imprimir un ticket con todos los productos
                            const mainPrintPayload = {
                                nombreEmpresa: currentTenant.name,
                                fecha: new Date().toISOString(),
                                numeroComprobante: generatedFdocNumber || createdOrder.order_number,
                                tipoComprobante: generatedFdocNumber ? "FACTURA" : "TICKET",
                                items: ticketItemsForPrint,
                                total,
                                pieDePagina: "Gracias por su compra"
                            };
                            await fetch(printEndpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(mainPrintPayload)
                            });
                            ticketCount++;

                            // Pequeño delay antes de imprimir tickets por categoría
                            if (printSeparateByCategory) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }

                            // 2. Si está habilitada la opción, imprimir tickets adicionales por categoría
                            if (printSeparateByCategory) {
                                // Agrupar items por categoría
                                const itemsByCategory = new Map<string, CartItem[]>();
                                cart.forEach(item => {
                                    const categoryId = item.product.category_id || 'sin-categoria';
                                    if (!itemsByCategory.has(categoryId)) {
                                        itemsByCategory.set(categoryId, []);
                                    }
                                    itemsByCategory.get(categoryId)!.push(item);
                                });

                                // Enviar un ticket por cada categoría que tenga print_separately habilitado
                                for (const [categoryId, categoryItems] of itemsByCategory) {
                                    const category = categories.find(c => c.id === categoryId);
                                    
                                    // Solo imprimir si la categoría tiene print_separately explícitamente habilitado
                                    if (!category || category.print_separately !== true) {
                                        continue;
                                    }

                                    const categoryName = category?.name || 'Sin Categoría';
                                    const totalCompleto = total;

                                    const printPayload = {
                                        nombreEmpresa: currentTenant.name,
                                        fecha: new Date().toISOString(),
                                        numeroComprobante: generatedFdocNumber || createdOrder.order_number,
                                        tipoComprobante: generatedFdocNumber ? "FACTURA" : "TICKET",
                                        categoria: categoryName,
                                        items: categoryItems.map(item => ({
                                            name: item.product.name,
                                            quantity: item.quantity,
                                            price: item.product.sale_price
                                        })),
                                        total: totalCompleto,
                                        pieDePagina: "Gracias por su compra"
                                    };
                                    await fetch(printEndpoint, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(printPayload)
                                    });

                                    ticketCount++;
                                }
                            }

                            showToast(`${ticketCount} ticket${ticketCount > 1 ? 's' : ''} enviado${ticketCount > 1 ? 's' : ''} a imprimir`, 'success');
                        } else {
                            console.warn('Auto print enabled but no print_endpoint configured');
                        }
                    }
                }
            } catch (printError) {
                console.error('Error al imprimir:', printError);
                // No mostrar error de impresión, solo log
            }

            clearCart();
            clearPaymentAllocations();
            setSelectedCustomer('');
            setCurrentTable(null);
            setCurrentOrderId(null);

            // Silently refresh stock quantities without full grid reload
            await refreshStock();
        } catch (error) {
            console.error('Error creating order:', error);
            showToast(error instanceof Error ? error.message : 'Error al crear el pedido', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Get button text based on operation mode
    // Handle save temporary order (for restaurant mode)
    const handleSaveTemporary = async () => {
        if (!currentTable) {
            showToast('No hay mesa seleccionada', 'error');
            return;
        }

        if (cart.length === 0) {
            showToast('El carrito está vacío', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            // Create order if it doesn't exist yet (first time adding items)
            let orderId = currentOrderId;
            if (!orderId) {
                const waiterId = searchParams.get('waiter') || undefined;
                orderId = await tableService.createOrderForTable(
                    currentTable.id,
                    waiterId,
                    selectedCustomer || undefined
                );
                setCurrentOrderId(orderId);
                showToast('Orden creada', 'success');
            }

            // Get current order to check existing items
            const currentOrder = await orderService.getById(orderId);
            const existingItems = currentOrder?.items || [];

            // Check if there are any changes (new items, removed items, or quantity changes)
            const cartMap = new Map(cart.map(item => [item.product.id, item.quantity]));
            const existingMap = new Map(existingItems.map((item: any) => [item.product_id, item.quantity]));

            let hasChanges = cart.length !== existingItems.length;

            if (!hasChanges) {
                // Check if quantities changed
                for (const [productId, quantity] of cartMap) {
                    if (existingMap.get(productId) !== quantity) {
                        hasChanges = true;
                        break;
                    }
                }
            }

            if (hasChanges) {
                // Delete all existing items and add all cart items (full sync)
                await orderService.deleteOrderItems(orderId);

                const orderItems = cart.map(item => {
                    const itemTotal = item.product.sale_price * item.quantity; // precio con IVA incluido
                    const taxRatePercent = getTaxRatePercent(item.product.tax_rate);
                    const taxRate = taxRatePercent / 100;
                    // Subtotal = Total / (1 + tasa_iva)
                    const itemSubtotal = itemTotal / (1 + taxRate);
                    
                    return {
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.product.sale_price,
                        subtotal: itemSubtotal
                    };
                });

                await orderService.addItemsToOrder(orderId, orderItems);
                showToast('Pedido guardado temporalmente', 'success');
            } else {
                showToast('No hay cambios para guardar', 'info');
            }

            clearCart();
            clearPaymentAllocations();
            navigate('/tables');
        } catch (error) {
            console.error('Error saving temporary order:', error);
            showToast('Error al guardar el pedido', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Get page title based on context
    const getPageTitle = () => {
        if (currentTable) {
            if (currentTable.status === 'WAITING_PAYMENT') {
                return `Pago Mesa ${currentTable.name}`;
            }
            return `Mesa ${currentTable.name} - Punto de Venta`;
        }
        return 'Punto de Venta';
    };

    // Handle print ticket (restaurant mode) - sets table to WAITING_PAYMENT
    const handlePrintTicket = async () => {
        if (!currentTable) {
            showToast('No hay mesa seleccionada', 'error');
            return;
        }

        if (cart.length === 0) {
            showToast('El carrito está vacío', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            // Create order if it doesn't exist yet
            let orderId = currentOrderId;
            if (!orderId) {
                const waiterId = searchParams.get('waiter') || undefined;
                orderId = await tableService.createOrderForTable(
                    currentTable.id,
                    waiterId,
                    selectedCustomer || undefined
                );
                setCurrentOrderId(orderId);
            }

            // Get current order to check existing items
            const currentOrder = await orderService.getById(orderId);
            const existingItems = currentOrder?.items || [];

            // Check if there are any changes (new items or quantity changes)
            const cartMap = new Map(cart.map(item => [item.product.id, item.quantity]));
            const existingMap = new Map(existingItems.map((item: any) => [item.product_id, item.quantity]));

            let hasChanges = cart.length !== existingItems.length;

            if (!hasChanges) {
                // Check if quantities changed
                for (const [productId, quantity] of cartMap) {
                    if (existingMap.get(productId) !== quantity) {
                        hasChanges = true;
                        break;
                    }
                }
            }

            // If there are changes, sync the order items with the cart
            if (hasChanges && cart.length > 0) {
                // Delete all existing order items
                await orderService.deleteOrderItems(orderId);

                // Add all items from cart
                const orderItems = cart.map(item => {
                    const itemTotal = item.product.sale_price * item.quantity; // precio con IVA incluido
                    const taxRatePercent = getTaxRatePercent(item.product.tax_rate);
                    const taxRate = taxRatePercent / 100;
                    // Subtotal = Total / (1 + tasa_iva)
                    const itemSubtotal = itemTotal / (1 + taxRate);
                    
                    return {
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.product.sale_price,
                        subtotal: itemSubtotal
                    };
                });

                await orderService.addItemsToOrder(orderId, orderItems);
            }

            // Set table to WAITING_PAYMENT
            await tableService.setWaitingPayment(currentTable.id);

            // Reload table to get updated status
            const updatedTable = await tableService.getById(currentTable.id);
            setCurrentTable(updatedTable);

            // Reload order items to show in cart
            if (currentOrderId) {
                const order = await orderService.getById(currentOrderId);
                if (order && order.items) {
                    const cartItems: CartItem[] = order.items.map((item: any) => ({
                        product: item.product,
                        quantity: item.quantity,
                    }));
                    setCart(cartItems);
                    setDiscountPercentInput('');
                }
            }

            // TODO: Integrate with printer here

            showToast('Ticket impreso. Selecciona el método de pago', 'success');
        } catch (error) {
            console.error('Error printing ticket:', error);
            showToast('Error al imprimir ticket', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle payment processing
    const handleProcessPayment = async () => {
        if (!currentTable || !currentOrderId) {
            showToast('No hay orden activa', 'error');
            return;
        }

        if (paymentAllocations.length === 0) {
            showToast('Agrega al menos un método de pago', 'error');
            return;
        }

        if (!isPaymentComplete) {
            if (paymentDifference > 0.01) {
                showToast(`Faltan $${paymentDifference.toFixed(2)} por asignar`, 'error');
            } else {
                showToast(`Hay $${Math.abs(paymentDifference).toFixed(2)} de más asignado`, 'error');
            }
            return;
        }

        setIsProcessing(true);
        try {
            // Update order with customer if selected
            if (selectedCustomer) {
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({ customer_id: selectedCustomer })
                    .eq('id', currentOrderId);

                if (updateError) throw updateError;
            }

            // Process payment with mixed payments
            await tableService.processPayment(
                currentTable.id,
                paymentAllocations,
                hasAutoInvoicePayment
            );

            if (hasAutoInvoicePayment) {
                showToast('Pago procesado y factura generada', 'success');
            } else {
                showToast('Pago registrado exitosamente', 'success');
            }

            clearPaymentAllocations();
            navigate('/tables');
        } catch (error) {
            console.error('Error processing payment:', error);
            showToast('Error al procesar el pago', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle edit order (go back from WAITING_PAYMENT to OCCUPIED)
    const handleEditOrder = async () => {
        if (!currentTable || !currentOrderId) {
            showToast('No hay orden activa', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            // Change table status back to OCCUPIED
            await tableService.updateStatus(currentTable.id, 'OCCUPIED');

            // Reload table to get updated status
            const updatedTable = await tableService.getById(currentTable.id);
            setCurrentTable(updatedTable);

            showToast('Ahora puedes editar el pedido', 'success');
        } catch (error) {
            console.error('Error editing order:', error);
            showToast('Error al editar el pedido', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Layout title={getPageTitle()}>
            <FadeIn>
                <div className={styles.container}>
                    <div className={styles.mainContent}>
                        {/* Show products only if not in WAITING_PAYMENT mode */}
                        {currentTable?.status !== 'WAITING_PAYMENT' && (
                            <>
                                {/* Filters Section */}
                                <div className={styles.filtersSection}>
                                    <div className={styles.searchBar}>
                                        <Search size={20} className={styles.searchIcon} />
                                        <input
                                            type="text"
                                            placeholder="Buscar productos..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className={styles.searchInput}
                                        />
                                    </div>
                                    <div className={styles.categoryFilters}>
                                        <button
                                            className={`${styles.categoryButton} ${selectedCategory === 'all' ? styles.active : ''}`}
                                            onClick={() => setSelectedCategory('all')}
                                        >
                                            Todos
                                        </button>
                                        {categories.map(category => (
                                            <button
                                                key={category.id}
                                                className={`${styles.categoryButton} ${selectedCategory === category.id ? styles.active : ''}`}
                                                onClick={() => setSelectedCategory(category.id)}
                                            >
                                                {category.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Products Grid */}
                                <div className={styles.productsGrid}>
                                    {loading ? (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <LoadingPlaceholder />
                                        </div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className={styles.emptyMessage}>No se encontraron productos</div>
                                    ) : (
                                        filteredProducts.map(product => (
                                            <div
                                                key={product.id}
                                                className={styles.productCard}
                                                onClick={() => addToCart(product)}
                                            >
                                                <div className={styles.productImage}>
                                                    {product.image_url ? (
                                                        <img
                                                            src={product.image_url}
                                                            alt={product.name}
                                                            loading="lazy"
                                                            decoding="async"
                                                        />
                                                    ) : (
                                                        <div className={styles.noImage}>
                                                            <ShoppingCart size={32} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.productInfo}>
                                                    <h3 className={styles.productName}>
                                                        {product.name}
                                                        {product.allows_custom_quantity && (
                                                            <Scale size={12} style={{ marginLeft: '0.25rem', opacity: 0.6, verticalAlign: 'middle' }} />
                                                        )}
                                                    </h3>
                                                    <p className={styles.productPrice}>${product.sale_price.toFixed(2)}</p>
                                                    <p className={styles.productStock}>Stock: {product.stock_quantity}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {/* Show message when waiting for payment */}
                        {currentTable?.status === 'WAITING_PAYMENT' && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                padding: 'var(--spacing-xl)',
                                textAlign: 'center',
                                color: 'var(--color-text-secondary)'
                            }}>
                                <CreditCard size={48} style={{ marginBottom: 'var(--spacing-md)' }} />
                                <h3 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '1.25rem' }}>Mesa en Espera de Pago</h3>
                                <p style={{ maxWidth: '400px' }}>Selecciona el método de pago para confirmar, o toca "Editar Pedido" para modificar la orden.</p>
                            </div>
                        )}
                    </div>

                    {/* Cart Summary Panel */}
                    <div className={styles.cartPanel}>
                        {/* Table indicator for restaurant mode */}
                        {currentTable && (
                            <div style={{
                                padding: '6px 10px',
                                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.8125rem',
                                marginBottom: '8px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <UtensilsCrossed size={13} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                                    <span style={{ color: 'var(--color-text-main)', fontSize: '0.8125rem' }}>
                                        <strong>{currentTable.name}</strong>
                                        {currentTable.location && <span style={{ opacity: 0.7 }}> · {currentTable.location}</span>}
                                    </span>
                                </div>
                                <button
                                    onClick={() => navigate('/tables')}
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: '0.6875rem',
                                        backgroundColor: 'transparent',
                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                        borderRadius: '4px',
                                        color: 'var(--color-warning)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    Cambiar
                                </button>
                            </div>
                        )}
                        <div className={styles.cartHeader}>
                            <h2 className={styles.cartTitle}>
                                <ShoppingCart size={24} />
                                Resumen del Pedido
                            </h2>
                            <div className={styles.headerActions}>
                                <div className={styles.compactCustomerSelect}>
                                    <select
                                        className={styles.selectCompact}
                                        value={selectedCustomer}
                                        onChange={(e) => setSelectedCustomer(e.target.value)}
                                    >
                                        <option value="">Anónimo</option>
                                        {customers.map(customer => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.business_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearCart}
                                    style={{ visibility: cart.length > 0 ? 'visible' : 'hidden' }}
                                >
                                    <X size={18} />
                                </Button>
                            </div>
                        </div>

                        {/* Cart Items */}
                        <div className={styles.cartItems}>
                            {cart.length === 0 ? (
                                <div className={styles.emptyCart}>
                                    <ShoppingCart size={48} />
                                    <p>El carrito está vacío</p>
                                </div>
                            ) : (
                                <>
                                    {cart.map((item, index) => (
                                        <div key={`${item.product.id}-${index}`} className={styles.cartItem}>
                                            <div className={styles.cartItemInfo}>
                                                <h4 className={styles.cartItemName}>{item.product.name}</h4>
                                                <p className={styles.cartItemPrice}>
                                                    ${item.product.sale_price.toFixed(2)}
                                                </p>
                                            </div>
                                            <div className={styles.cartItemControls}>
                                                {item.product.allows_custom_quantity ? (
                                                    <>
                                                        <button
                                                            className={styles.quantityButton}
                                                            onClick={() => {
                                                                setCustomQuantityModal({
                                                                    isOpen: true,
                                                                    product: item.product,
                                                                    quantity: item.quantity.toString()
                                                                });
                                                                setTimeout(() => customQuantityInputRef.current?.focus(), 100);
                                                            }}
                                                            disabled={currentTable?.status === 'WAITING_PAYMENT'}
                                                            style={{ padding: '0.25rem 0.5rem', minWidth: 'auto' }}
                                                            title="Editar cantidad"
                                                        >
                                                            <Scale size={12} />
                                                        </button>
                                                        <span className={styles.quantity} style={{ minWidth: '3rem' }}>
                                                            {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            className={styles.quantityButton}
                                                            onClick={() => updateQuantity(item.product.id, -1)}
                                                            disabled={currentTable?.status === 'WAITING_PAYMENT' || item.quantity <= 1}
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className={styles.quantity}>{item.quantity}</span>
                                                        <button
                                                            className={styles.quantityButton}
                                                            onClick={() => updateQuantity(item.product.id, 1)}
                                                            disabled={currentTable?.status === 'WAITING_PAYMENT' || (controlStock && item.quantity >= item.product.stock_quantity)}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    className={styles.removeButton}
                                                    onClick={() => removeFromCart(item.product.id)}
                                                    disabled={currentTable?.status === 'WAITING_PAYMENT'}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className={styles.cartItemTotal}>
                                                ${(item.product.sale_price * item.quantity).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}

                                </>
                            )}

                            {cart.length > 0 && discountAmount > 0 && (
                                <div className={styles.discountListTag}>
                                    -{discountPercentLabel}%
                                </div>
                            )}
                        </div>

                        {/* Cart Summary - Always visible at bottom */}
                        {cart.length > 0 && (
                            <div className={styles.cartFooter}>
                                <div className={styles.footerControlsRow}>
                                    {(!currentTable || currentTable.status === 'WAITING_PAYMENT') && (
                                        <div className={`${styles.inlineCustomerSection} ${styles.controlCard}`}>
                                            <label className={styles.discountControlLabel}>Cliente</label>
                                            <div className={styles.inlineCustomerSelectContainer}>
                                                <button
                                                    className={styles.inlineCustomerButton}
                                                    onClick={() => setIsCustomerModalOpen(true)}
                                                >
                                                    {selectedCustomerData
                                                        ? selectedCustomerData.business_name
                                                        : '+ Seleccionar Cliente'}
                                                </button>
                                                {selectedCustomer && (
                                                    <button
                                                        className={styles.closeButton}
                                                        onClick={() => setSelectedCustomer('')}
                                                        title="Quitar cliente"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`${styles.discountControlSection} ${styles.controlCard}`}>
                                        <label className={styles.discountControlLabel}>Descuento (%)</label>
                                        <div className={styles.discountControlRow}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={discountPercentInput}
                                                onChange={(e) => {
                                                    const sanitized = e.target.value.replace(/[^\d.,]/g, '');
                                                    setDiscountPercentInput(sanitized);
                                                }}
                                                className={styles.discountControlInput}
                                                disabled={currentTable?.status === 'WAITING_PAYMENT'}
                                            />
                                            <span className={styles.discountControlSuffix}>%</span>
                                            <button
                                                className={styles.removeButton}
                                                onClick={() => setDiscountPercentInput('')}
                                                disabled={currentTable?.status === 'WAITING_PAYMENT' || discountPercent <= 0}
                                                title="Quitar descuento"
                                                style={{ visibility: discountPercent > 0 ? 'visible' : 'hidden' }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Mixed Payment Section - Show when waiting for payment or in KIOSCO mode */}
                                {(currentTable?.status === 'WAITING_PAYMENT' || !currentTable) && (
                                    <div className={`${styles.paymentMethodSection} ${styles.controlCard}`}>
                                        <label className={styles.paymentMethodLabel}>
                                            Métodos de Pago
                                            {paymentAllocations.length > 0 && (
                                                <span className={styles.paymentSummary}>
                                                    ({paymentAllocations.length} método{paymentAllocations.length > 1 ? 's' : ''})
                                                </span>
                                            )}
                                        </label>

                                        {/* Current Allocations */}
                                        {paymentAllocations.length > 0 && (
                                            <div className={styles.paymentAllocationsList}>
                                                {paymentAllocations.map(allocation => {
                                                    const method = paymentMethods.find(m => m.id === allocation.payment_method_id);
                                                    return (
                                                        <div key={allocation.payment_method_id} className={styles.paymentAllocationItem}>
                                                            <span className={styles.paymentMethodIcon}>
                                                                {method?.icon === 'Banknote' && '💵'}
                                                                {method?.icon === 'CreditCard' && '💳'}
                                                                {method?.icon === 'Smartphone' && '📱'}
                                                            </span>
                                                            <span className={styles.paymentMethodName}>{method?.name}</span>
                                                            <span className={styles.paymentAmount}>
                                                                ${allocation.amount.toFixed(2)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className={styles.removePaymentBtn}
                                                                onClick={() => removePaymentAllocation(allocation.payment_method_id)}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Remaining Amount */}
                                        {remainingAmount > 0 && cart.length > 0 && (
                                            <div className={styles.remainingAmount}>
                                                <span>Restante por pagar:</span>
                                                <strong>${remainingAmount.toFixed(2)}</strong>
                                            </div>
                                        )}

                                        {/* Payment Complete Indicator */}
                                        {isPaymentComplete && (
                                            <div className={styles.paymentCompleteIndicator}>
                                                Pago completo
                                            </div>
                                        )}

                                        {/* Custom Amount Input */}
                                        {remainingAmount > 0 && cart.length > 0 && (
                                            <div className={styles.customAmountSection}>
                                                <input
                                                    type="number"
                                                    placeholder={`Monto (máx $${remainingAmount.toFixed(2)})`}
                                                    value={customPaymentAmount}
                                                    onChange={(e) => setCustomPaymentAmount(e.target.value)}
                                                    className={styles.customAmountInput}
                                                    min="0.01"
                                                    max={remainingAmount}
                                                    step="0.01"
                                                />
                                                <span className={styles.customAmountHint}>
                                                    {customPaymentAmount ? `$${getPaymentAmount().toFixed(2)}` : 'Todo'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Payment Methods Grid */}
                                        <div className={styles.paymentMethodGrid}>
                                            {(paymentMethodsExpanded
                                                ? paymentMethods
                                                : paymentMethods.slice(0, 3)
                                            ).map(method => (
                                                <button
                                                    key={method.id}
                                                    type="button"
                                                    className={styles.paymentMethodButton}
                                                    onClick={() => {
                                                        const amount = getPaymentAmount();
                                                        if (amount > 0) {
                                                            addPaymentAllocation(method.id, amount);
                                                        }
                                                    }}
                                                    disabled={remainingAmount <= 0 || cart.length === 0}
                                                >
                                                    <span className={styles.paymentMethodIcon}>
                                                        {method.icon === 'Banknote' && '💵'}
                                                        {method.icon === 'CreditCard' && '💳'}
                                                        {method.icon === 'Smartphone' && '📱'}
                                                    </span>
                                                    <span>{method.name}</span>
                                                </button>
                                            ))}
                                            {paymentMethods.length > 3 && (
                                                <button
                                                    type="button"
                                                    className={`${styles.paymentMethodButton} ${styles.expandButton}`}
                                                    onClick={() => setPaymentMethodsExpanded(!paymentMethodsExpanded)}
                                                >
                                                    <span className={styles.paymentMethodIcon}>
                                                        {paymentMethodsExpanded ? '−' : '...'}
                                                    </span>
                                                    <span>{paymentMethodsExpanded ? 'Menos' : `+${paymentMethods.length - 3}`}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className={`${styles.cartSummary} ${styles.totalCard}`}>
                                    <div className={styles.summaryTotal}>
                                        <span>Total:</span>
                                        <span>${total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Action buttons based on mode */}
                                {currentTable?.status === 'WAITING_PAYMENT' ? (
                                    // Payment mode (restaurant - waiting for payment)
                                    <div className={styles.actionButtons}>
                                        <Button
                                            variant="secondary"
                                            onClick={handleEditOrder}
                                            isLoading={isProcessing}
                                        >
                                            <Edit2 size={16} style={{ marginRight: '0.375rem' }} />
                                            Editar Pedido
                                        </Button>
                                        <div className={styles.actionButtonsRow}>
                                            <Button
                                                variant="secondary"
                                                onClick={() => navigate('/tables')}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                onClick={handleProcessPayment}
                                                isLoading={isProcessing}
                                                disabled={!isPaymentComplete}
                                                style={{ flex: 1 }}
                                            >
                                                Confirmar Pago
                                            </Button>
                                        </div>
                                    </div>
                                ) : currentTable ? (
                                    // Restaurant mode - normal operation
                                    <div className={styles.actionButtons}>
                                        <Button
                                            onClick={handleSaveTemporary}
                                            isLoading={isProcessing}
                                            variant="secondary"
                                        >
                                            Guardar Temporalmente
                                        </Button>
                                        <Button
                                            onClick={handlePrintTicket}
                                            isLoading={isProcessing}
                                        >
                                            <Printer size={16} style={{ marginRight: '0.375rem' }} />
                                            Imprimir Ticket
                                        </Button>
                                    </div>
                                ) : (
                                    // KIOSCO/DISTRIBUIDOR mode
                                    <Button
                                        onClick={handleCheckout}
                                        isLoading={isProcessing}
                                        disabled={!selectedPaymentMethod}
                                        className={styles.checkoutButtonFull}
                                    >
                                        <CreditCard size={16} style={{ marginRight: '0.375rem' }} />
                                        Finalizar Pedido
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Custom Quantity Modal for bulk/weighted products */}
                <Modal
                    isOpen={isCustomerModalOpen}
                    onClose={() => setIsCustomerModalOpen(false)}
                    title="Seleccionar o Crear Cliente"
                >
                    <div className={styles.customerModalContent}>
                        <div className={styles.customerModalSection}>
                            <label className={styles.label}>Buscar cliente por nombre o documento</label>
                            <input
                                type="text"
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                placeholder="Ej: Juan Perez o 30123456"
                                className={styles.customerModalSearchInput}
                            />

                            <div className={styles.customerModalResults}>
                                {filteredCustomersBySearch.length === 0 ? (
                                    <div className={styles.customerModalEmpty}>No se encontraron clientes</div>
                                ) : (
                                    filteredCustomersBySearch.map(customer => (
                                        <button
                                            type="button"
                                            key={customer.id}
                                            className={styles.customerResultItem}
                                            onClick={() => handleSelectCustomer(customer.id)}
                                        >
                                            <div className={styles.customerResultMain}>{customer.business_name}</div>
                                            <div className={styles.customerResultMeta}>
                                                {customer.document_number ? `Documento: ${customer.document_number}` : 'Sin documento'}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className={styles.customerModalDivider}>o</div>

                        <form className={styles.customerCreateForm} onSubmit={handleCreateCustomerInline}>
                            <h4 className={styles.customerCreateTitle}>Alta rápida</h4>

                            <input
                                type="text"
                                placeholder="Razón Social *"
                                value={newCustomerDraft.business_name || ''}
                                onChange={(e) => setNewCustomerDraft(prev => ({ ...prev, business_name: e.target.value }))}
                                className={styles.customerFormInput}
                                required
                            />

                            <div className={styles.customerFormRow}>
                                <input
                                    type="text"
                                    placeholder="Numero de documento"
                                    inputMode="numeric"
                                    maxLength={20}
                                    value={newCustomerDraft.document_number || ''}
                                    onChange={(e) => setNewCustomerDraft(prev => ({ ...prev, document_number: e.target.value.replace(/\D/g, '').slice(0, 20) }))}
                                    className={styles.customerFormInput}
                                />
                                <input
                                    type="text"
                                    placeholder="Teléfono"
                                    value={newCustomerDraft.phone || ''}
                                    onChange={(e) => setNewCustomerDraft(prev => ({ ...prev, phone: e.target.value }))}
                                    className={styles.customerFormInput}
                                />
                            </div>

                            <input
                                type="text"
                                placeholder="Contacto"
                                value={newCustomerDraft.contact_name || ''}
                                onChange={(e) => setNewCustomerDraft(prev => ({ ...prev, contact_name: e.target.value }))}
                                className={styles.customerFormInput}
                            />

                            <input
                                type="email"
                                placeholder="Email"
                                value={newCustomerDraft.email || ''}
                                onChange={(e) => setNewCustomerDraft(prev => ({ ...prev, email: e.target.value }))}
                                className={styles.customerFormInput}
                            />

                            <div className={styles.customerModalActions}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsCustomerModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" isLoading={isSavingCustomer}>
                                    Guardar y Seleccionar
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>

                <Modal
                    isOpen={customQuantityModal.isOpen}
                    onClose={() => setCustomQuantityModal({ isOpen: false, product: null, quantity: '' })}
                    title="Cantidad Personalizada"
                >
                    {customQuantityModal.product && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <Scale size={24} style={{ color: 'var(--color-primary)' }} />
                                <div>
                                    <p style={{ fontWeight: 500, margin: 0 }}>{customQuantityModal.product.name}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                                        Precio por unidad: ${customQuantityModal.product.sale_price.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 500
                                }}>
                                    Cantidad (unidades)
                                </label>
                                <input
                                    ref={customQuantityInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    value={customQuantityModal.quantity}
                                    onChange={(e) => setCustomQuantityModal(prev => ({ ...prev, quantity: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCustomQuantityConfirm();
                                        }
                                    }}
                                    placeholder="Ej: 1.55"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        fontSize: '1.25rem',
                                        textAlign: 'center',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--color-bg-main)',
                                        color: 'var(--color-text-main)'
                                    }}
                                />
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--color-text-secondary)',
                                    marginTop: '0.5rem',
                                    textAlign: 'center'
                                }}>
                                    Ingresa la cantidad. Ej: 1.55 para 155gr si la unidad es 100gr
                                </p>
                            </div>

                            {customQuantityModal.quantity && !isNaN(parseFloat(customQuantityModal.quantity.replace(',', '.'))) && (
                                <div style={{
                                    padding: '0.75rem',
                                    backgroundColor: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
                                    borderRadius: 'var(--radius-md)',
                                    textAlign: 'center'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                        Total estimado
                                    </p>
                                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-success, #22c55e)' }}>
                                        ${(customQuantityModal.product.sale_price * parseFloat(customQuantityModal.quantity.replace(',', '.'))).toFixed(2)}
                                    </p>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setCustomQuantityModal({ isOpen: false, product: null, quantity: '' })}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCustomQuantityConfirm}
                                    style={{ flex: 1 }}
                                >
                                    Agregar al Carrito
                                </Button>
                            </div>
                        </div>
                    )}
                </Modal>
            </FadeIn >
        </Layout >
    );
};

export default PointOfSale;
