import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDown, Printer } from 'lucide-react';
import { cashRegisterService } from '../services/cashRegisterService';
import { printCashRegisterClose } from '../utils/printerUtils';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Layout from '../components/layout/Layout';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/shadcn-table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/shadcn-pagination';
import { useServerPagination } from '../hooks/useServerPagination';
import { useToast } from '../context/ToastContext';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import styles from './CashRegisterHistory.module.css';

const CashRegisterHistory: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const {
        data: closures,
        loading,
        currentPage,
        totalPages,
        goToPage,
        nextPage,
        previousPage,
        hasNextPage,
        hasPreviousPage,
    } = useServerPagination({
        fetchFunction: cashRegisterService.getClosureHistoryPaginated,
        pageSize: 20,
    });

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

    const handleExportCSV = async () => {
        const allClosures = await cashRegisterService.getClosureHistory();
        const data = allClosures.map(closure => ({
            fecha: formatDate(closure.closure_date),
            usuario: closure.user_email,
            total: closure.total_amount,
            ordenes: closure.order_count,
            notas: closure.notes || ''
        }));
        const columns = [
            { header: 'Fecha y Hora', key: 'fecha' },
            { header: 'Usuario', key: 'usuario' },
            { header: 'Total', key: 'total' },
            { header: 'Órdenes', key: 'ordenes' },
            { header: 'Notas', key: 'notas' }
        ];
        exportToCSV(data, 'cierres-caja', columns);
        showToast('CSV exportado exitosamente', 'success');
    };

    const handleExportPDF = () => {
        const data = closures.map(closure => ({
            fecha: formatDate(closure.closure_date),
            usuario: closure.user_email,
            total: formatCurrency(closure.total_amount),
            ordenes: closure.order_count,
            notas: closure.notes || '-'
        }));
        const columns = [
            { header: 'Fecha y Hora', key: 'fecha' },
            { header: 'Usuario', key: 'usuario' },
            { header: 'Total', key: 'total' },
            { header: 'Órdenes', key: 'ordenes' },
            { header: 'Notas', key: 'notas' }
        ];
        exportToPDF(data, 'cierres-caja', columns, 'Historial de Cierres de Caja', (error) => {
            showToast(error, 'error');
        });
        showToast('PDF exportado exitosamente', 'success');
    };

    const handlePrint = async (closureId: string) => {
        try {
            showToast('Preparando impresión...', 'info');
            const reportData = await cashRegisterService.getClosureReportData(closureId);
            await printCashRegisterClose(reportData);
            showToast('Enviado a la impresora', 'success');
        } catch (error) {
            console.error('Error printing closure:', error);
            showToast('Error al imprimir el cierre', 'error');
        }
    };

    if (loading) {
        return (
            <Layout>
                <LoadingPlaceholder />
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <Button
                            variant="secondary"
                            onClick={() => navigate('/cash-register')}
                        >
                            <ArrowLeft size={20} />
                            Volver a Caja
                        </Button>
                        <h1 className={styles.title}>Historial de Cierres de Caja</h1>
                    </div>
                    <div className={styles.headerActions}>
                        <Button variant="secondary" onClick={handleExportCSV}>
                            <FileDown size={20} />
                            CSV
                        </Button>
                        <Button variant="secondary" onClick={handleExportPDF}>
                            <FileDown size={20} />
                            PDF
                        </Button>
                    </div>
                </div>

                <Card>
                    {closures.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No hay cierres de caja registrados</p>
                        </div>
                    ) : (
                        <div>
                            <div className="rounded-md overflow-hidden" style={{ 
                                border: '1px solid var(--color-border)'
                            }}>
                                <Table>
                                <TableHeader>
                                    <TableRow style={{ 
                                        backgroundColor: 'var(--table-header-bg)',
                                        color: 'var(--table-header-text)',
                                    }}>
                                        <TableHead>Fecha y Hora</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Órdenes</TableHead>
                                        <TableHead>Notas</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {closures.map(closure => (
                                        <TableRow key={closure.id}>
                                            <TableCell>{formatDate(closure.closure_date)}</TableCell>
                                            <TableCell>{closure.user_email}</TableCell>
                                            <TableCell className={styles.amount}>
                                                {formatCurrency(closure.total_amount)}
                                            </TableCell>
                                            <TableCell>{closure.order_count}</TableCell>
                                            <TableCell className={styles.notes}>
                                                {closure.notes || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handlePrint(closure.id)}
                                                    title="Imprimir comprobante"
                                                >
                                                    <Printer size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className={styles.totalRow}>
                                        <TableCell colSpan={2}>
                                            <strong>Total General</strong>
                                        </TableCell>
                                        <TableCell className={styles.amount}>
                                            <strong>
                                                {formatCurrency(
                                                    closures.reduce((sum, c) => sum + c.total_amount, 0)
                                                )}
                                            </strong>
                                        </TableCell>
                                        <TableCell>
                                            <strong>
                                                {closures.reduce((sum, c) => sum + c.order_count, 0)}
                                            </strong>
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                            </div>
                        </div>
                    )}
                </Card>
                
                {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious 
                                        onClick={previousPage}
                                        className={!hasPreviousPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                                
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <PaginationItem key={page}>
                                        <PaginationLink
                                            onClick={() => goToPage(page)}
                                            isActive={currentPage === page}
                                            className="cursor-pointer"
                                        >
                                            {page}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                                
                                <PaginationItem>
                                    <PaginationNext 
                                        onClick={nextPage}
                                        className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default CashRegisterHistory;
