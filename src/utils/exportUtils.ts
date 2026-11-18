export const exportToCSV = (data: Record<string, unknown>[], filename: string, columns: { header: string; key: string }[]) => {
    // Create CSV header
    const headers = columns.map(col => col.header).join(',');

    // Create CSV rows
    const rows = data.map(item => {
        return columns.map(col => {
            const value = item[col.key];
            // Escape commas and quotes
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    }).join('\n');

    // Combine headers and rows
    const csv = `${headers}\n${rows}`;

    // Create blob and download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToPDF = (
    data: Record<string, unknown>[],
    filename: string,
    columns: { header: string; key: string }[],
    title: string,
    onError?: (message: string) => void
) => {
    try {
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(18);
        doc.text(title, 14, 22);

        // Add date
        doc.setFontSize(11);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 30);

        // Prepare table data
        const tableHeaders = columns.map(col => col.header);
        const tableData = data.map(item =>
            columns.map(col => {
                const value = item[col.key];
                if (value === null || value === undefined) return '';
                return String(value);
            })
        );

        // Add table
        autoTable(doc, {
            head: [tableHeaders],
            body: tableData,
            startY: 35,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [66, 139, 202], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { top: 35 },
        });

        // Save PDF
        doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        const errorMessage = `Error al generar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`;
        if (onError) {
            onError(errorMessage);
        } else {
            // Fallback to console if no error handler provided
            console.error(errorMessage);
        }
    }
};
