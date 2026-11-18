import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CreditCard, Banknote, Smartphone } from 'lucide-react';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { paymentMethodService } from '../services/paymentMethodService';
import type { PaymentMethod, CreatePaymentMethodInput } from '../types/paymentMethod';
import styles from './PaymentMethods.module.css';

// Icon mapping for lucide icons
const ICON_MAP: Record<string, React.ElementType> = {
    'Banknote': Banknote,
    'CreditCard': CreditCard,
    'Smartphone': Smartphone,
};

const PaymentMethods: React.FC = () => {
    const { showToast } = useToast();
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
    const [formData, setFormData] = useState<CreatePaymentMethodInput>({
        name: '',
        description: '',
        auto_invoice: false,
        is_active: true,
        icon: 'Banknote',
        sort_order: 0,
    });

    useEffect(() => {
        loadPaymentMethods();
    }, []);

    const loadPaymentMethods = async () => {
        try {
            setLoading(true);
            const data = await paymentMethodService.getAllIncludingInactive();
            setPaymentMethods(data);
        } catch (error) {
            console.error('Error loading payment methods:', error);
            showToast('Error al cargar los métodos de pago', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (method?: PaymentMethod) => {
        if (method) {
            setEditingMethod(method);
            setFormData({
                name: method.name,
                description: method.description || '',
                auto_invoice: method.auto_invoice,
                is_active: method.is_active,
                icon: method.icon || 'Banknote',
                sort_order: method.sort_order,
            });
        } else {
            setEditingMethod(null);
            setFormData({
                name: '',
                description: '',
                auto_invoice: false,
                is_active: true,
                icon: 'Banknote',
                sort_order: paymentMethods.length,
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingMethod(null);
        setFormData({
            name: '',
            description: '',
            auto_invoice: false,
            is_active: true,
            icon: 'Banknote',
            sort_order: 0,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showToast('El nombre es requerido', 'error');
            return;
        }

        try {
            if (editingMethod) {
                await paymentMethodService.update(editingMethod.id, formData);
                showToast('Método de pago actualizado', 'success');
            } else {
                await paymentMethodService.create(formData);
                showToast('Método de pago creado', 'success');
            }
            await loadPaymentMethods();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving payment method:', error);
            showToast('Error al guardar el método de pago', 'error');
        }
    };

    const handleDelete = async (method: PaymentMethod) => {
        try {
            const isUsed = await paymentMethodService.isUsedInOrders(method.id);

            if (isUsed) {
                const confirmed = confirm(
                    `"${method.name}" está siendo utilizado en órdenes existentes.\n\nSe desactivará y no estará disponible para nuevas órdenes, pero se mantendrá en el historial.`
                );
                if (!confirmed) return;
                await paymentMethodService.softDelete(method.id);
                showToast('Método de pago desactivado', 'success');
            } else {
                const confirmed = confirm(
                    `"${method.name}" será eliminado definitivamente.\n\nEsta acción no se puede deshacer.`
                );
                if (!confirmed) return;
                await paymentMethodService.delete(method.id);
                showToast('Método de pago eliminado', 'success');
            }
            await loadPaymentMethods();
        } catch (error) {
            console.error('Error deleting payment method:', error);
            showToast('Error al eliminar el método de pago', 'error');
        }
    };

    const getIconComponent = (iconName?: string) => {
        if (!iconName) return Banknote;
        return ICON_MAP[iconName] || Banknote;
    };

    return (
        <Layout title="Métodos de Pago">
            <FadeIn>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Métodos de Pago</h1>
                            <p className={styles.subtitle}>
                                Gestiona los métodos de pago disponibles.
                            </p>
                        </div>
                        <Button onClick={() => handleOpenModal()}>
                            <Plus size={20} />
                            Nuevo Método
                        </Button>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Cargando...</div>
                    ) : (
                        <div className={styles.grid}>
                            {paymentMethods.map((method) => {
                                const IconComponent = getIconComponent(method.icon);
                                return (
                                    <div
                                        key={method.id}
                                        className={`${styles.card} ${!method.is_active ? styles.inactive : ''}`}
                                    >
                                        <div className={styles.cardTop}>
                                            <div className={styles.cardInfo}>
                                                <div className={styles.iconWrapper}>
                                                    <IconComponent size={20} />
                                                </div>
                                                <div>
                                                    <h3 className={styles.cardTitle}>{method.name}</h3>
                                                    <p className={styles.cardDescription}>
                                                        {method.description || '\u00A0'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={styles.cardActions}>
                                                <button
                                                    className={styles.iconButton}
                                                    onClick={() => handleOpenModal(method)}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                {method.is_active && (
                                                    <button
                                                        className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                                        onClick={() => handleDelete(method)}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <span className={`${styles.badge} ${method.auto_invoice ? styles.badgeSuccess : styles.badgeWarning}`}>
                                                {method.auto_invoice ? 'Auto' : 'Manual'}
                                            </span>
                                            {!method.is_active && (
                                                <span className={styles.badgeInactive}>Inactivo</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Modal
                    isOpen={showModal}
                    onClose={handleCloseModal}
                    title={editingMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
                >
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name">Nombre *</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: Efectivo, Tarjeta"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="description">Descripción</label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descripción opcional"
                                rows={3}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="icon">Ícono</label>
                            <select
                                id="icon"
                                value={formData.icon}
                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                            >
                                <option value="Banknote">Efectivo</option>
                                <option value="CreditCard">Tarjeta</option>
                                <option value="Smartphone">Digital</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formData.auto_invoice}
                                    onChange={(e) => setFormData({ ...formData, auto_invoice: e.target.checked })}
                                />
                                <span>
                                    Factura Automática (Digital)
                                    <small>Si está activado, se genera factura automáticamente al procesar el pago</small>
                                </span>
                            </label>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <span>Activo</span>
                            </label>
                        </div>

                        <div className={styles.modalActions}>
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {editingMethod ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            </FadeIn>
        </Layout>
    );
};

export default PaymentMethods;
