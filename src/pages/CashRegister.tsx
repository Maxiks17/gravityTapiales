import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Receipt, History, Calendar, Wallet } from 'lucide-react';
import { cashRegisterService, type CurrentSession } from '../services/cashRegisterService';
import { printCashRegisterClose } from '../utils/printerUtils';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { useToast } from '../context/ToastContext';
import styles from './CashRegister.module.css';

const CashRegister: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [session, setSession] = useState<CurrentSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [notes, setNotes] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        loadSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadSession = async () => {
        try {
            const data = await cashRegisterService.getCurrentSession();
            setSession(data);
        } catch (error) {
            console.error('Error loading session:', error);
            showToast('Error al cargar la sesión de caja', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseCashRegister = async () => {
        if (!session || session.order_count === 0) {
            showToast('No hay órdenes para cerrar la caja', 'error');
            return;
        }

        setIsClosing(true);
        try {
            // Obtener datos para el reporte antes de cerrar
            let reportData = null;
            try {
                reportData = await cashRegisterService.getSessionReportData();
            } catch (e) {
                console.error('Error preparing report data', e);
            }

            await cashRegisterService.closeCashRegister(notes);
            showToast('Caja cerrada exitosamente', 'success');
            setShowCloseModal(false);
            setNotes('');

            // Preguntar si desea imprimir
            if (reportData) {
                // Pequeño delay para asegurar que el modal se cierre visualmente
                setTimeout(async () => {
                    if (window.confirm('¿Desea imprimir el reporte de cierre de caja?')) {
                        try {
                            await printCashRegisterClose(reportData);
                            showToast('Reporte enviado a la impresora', 'success');
                        } catch (printError) {
                            console.error('Error printing report:', printError);
                            showToast('Error al imprimir el reporte', 'error');
                        }
                    }
                }, 500);
            }

            loadSession(); // Recargar para mostrar nueva sesión vacía
        } catch (error) {
            console.error('Error closing cash register:', error);
            showToast(error instanceof Error ? error.message : 'Error al cerrar la caja', 'error');
        } finally {
            setIsClosing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    };

    if (loading) {
        return (
            <Layout>
                <LoadingPlaceholder />
            </Layout>
        );
    }

    return (
        <Layout title="Caja">
            <FadeIn>
                <div className={styles.container}>
                <div className={styles.header}>
                    {session?.last_closure_date && (
                        <p className={styles.subtitle}>
                            <Calendar size={16} />
                            Último cierre: {formatDate(session.last_closure_date)}
                        </p>
                    )}
                    <div className={styles.headerActions}>
                        <Button
                            variant="secondary"
                            onClick={() => navigate('/cash-register/history')}
                            size="sm"
                        >
                            <History size={16} />
                            <span className={styles.buttonText}>Ver Historial</span>
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className={styles.statsGrid}>
                    <Card>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ backgroundColor: 'var(--color-success-light)' }}>
                                <DollarSign size={24} style={{ color: 'var(--color-success)' }} />
                            </div>
                            <div className={styles.statContent}>
                                <p className={styles.statLabel}>Total en Caja</p>
                                <h2 className={styles.statValue}>{formatCurrency(session?.total_amount || 0)}</h2>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)' }}>
                                <Wallet size={24} style={{ color: '#64748b' }} />
                            </div>
                            <div className={styles.statContent}>
                                <p className={styles.statLabel}>Órdenes Confirmadas</p>
                                <h2 className={styles.statValue}>{session?.order_count || 0}</h2>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Orders List */}
                <Card>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Órdenes de la Sesión Actual</h2>
                        {session && session.order_count > 0 && (
                            <Button onClick={() => setShowCloseModal(true)} size="sm">
                                Cerrar Caja
                            </Button>
                        )}
                    </div>

                    {!session || session.order_count === 0 ? (
                        <div className={styles.emptyState}>
                            <Receipt size={48} />
                            <p>No hay órdenes confirmadas en esta sesión</p>
                        </div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Nº Orden</th>
                                        <th>Cliente</th>
                                        <th>Fecha</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {session.orders.map(order => (
                                        <tr key={order.id}>
                                            <td>{order.order_number}</td>
                                            <td>{order.customer?.business_name || 'Cliente anónimo'}</td>
                                            <td>{formatDate(order.order_date)}</td>
                                            <td className={styles.amount}>{formatCurrency(order.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Close Cash Register Modal */}
                <Modal
                    isOpen={showCloseModal}
                    onClose={() => !isClosing && setShowCloseModal(false)}
                    title="Cerrar Caja"
                >
                    <div className={styles.modalContent}>
                        <div className={styles.closureSummary}>
                            <div className={styles.summaryRow}>
                                <span>Total de órdenes:</span>
                                <strong>{session?.order_count}</strong>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Total en caja:</span>
                                <strong className={styles.totalAmount}>
                                    {formatCurrency(session?.total_amount || 0)}
                                </strong>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="notes">Notas u Observaciones (opcional)</label>
                            <textarea
                                id="notes"
                                className={styles.textarea}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Agregar notas sobre este cierre..."
                                rows={4}
                                disabled={isClosing}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <Button
                                variant="secondary"
                                onClick={() => setShowCloseModal(false)}
                                disabled={isClosing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCloseCashRegister}
                                isLoading={isClosing}
                            >
                                Confirmar Cierre
                            </Button>
                        </div>
                    </div>
                </Modal>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default CashRegister;
