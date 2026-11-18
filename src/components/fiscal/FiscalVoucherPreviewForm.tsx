import { Button } from '../ui/Button';
import type { InvoicePayload } from '../../services/afipService';
import styles from './FiscalVoucherPreviewForm.module.css';

export interface VoucherPreviewFormData {
    emisorRazonSocial: string;
    emisorCuit: string;
    receptorRazonSocial: string;
    receptorCondicionFiscalId: number;
    receptorTipoDocumento: number;
    receptorNumeroDocumento: string;
    tipoComprobante: number;
    puntoVenta: number;
    importeTotal: number;
    importeNeto: number;
    importeIVA: number;
    importeTributo: number;
    ivaList: InvoicePayload['ivaList'];
}

interface OptionItem {
    value: number;
    label: string;
}

interface FiscalConditionItem {
    id: number;
    name: string;
}

interface FiscalVoucherPreviewFormProps<T extends VoucherPreviewFormData> {
    data: T;
    onChange: (updater: (prev: T) => T) => void;
    fiscalConditions: FiscalConditionItem[];
    documentOptions: OptionItem[];
    comprobanteOptions: OptionItem[];
    isComprobanteLocked?: boolean;
    comprobanteHelpText?: string;
    showIvaFields: boolean;
    cancelLabel: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
    isSubmitting?: boolean;
}

const FiscalVoucherPreviewForm = <T extends VoucherPreviewFormData>({
    data,
    onChange,
    fiscalConditions,
    documentOptions,
    comprobanteOptions,
    isComprobanteLocked = false,
    comprobanteHelpText,
    showIvaFields,
    cancelLabel,
    confirmLabel,
    onCancel,
    onConfirm,
    isSubmitting = false,
}: FiscalVoucherPreviewFormProps<T>) => {
    return (
        <div className={styles.voucherPreview}>
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Datos del emisor</h3>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label className={styles.label}>Razon social</label>
                        <input
                            type="text"
                            value={data.emisorRazonSocial}
                            onChange={(e) => onChange((prev) => ({ ...prev, emisorRazonSocial: e.target.value }))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>CUIT</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={data.emisorCuit}
                            onChange={(e) => onChange((prev) => ({ ...prev, emisorCuit: e.target.value.replace(/\D/g, '') }))}
                            className={styles.input}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Datos del receptor</h3>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label className={styles.label}>Razon social</label>
                        <input
                            type="text"
                            value={data.receptorRazonSocial}
                            onChange={(e) => onChange((prev) => ({ ...prev, receptorRazonSocial: e.target.value }))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Tipo de contribuyente</label>
                        <select
                            value={data.receptorCondicionFiscalId}
                            onChange={(e) => onChange((prev) => ({ ...prev, receptorCondicionFiscalId: Number(e.target.value || 0) }))}
                            className={styles.select}
                        >
                            <option value={0}>Sin especificar</option>
                            {fiscalConditions
                                .filter((condition) => condition.id !== 0)
                                .map((condition) => (
                                    <option key={condition.id} value={condition.id}>
                                        {condition.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Tipo de documento</label>
                        <select
                            value={data.receptorTipoDocumento}
                            onChange={(e) => onChange((prev) => ({ ...prev, receptorTipoDocumento: Number(e.target.value) }))}
                            className={styles.select}
                        >
                            {documentOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Numero de documento</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={20}
                            value={data.receptorNumeroDocumento}
                            onChange={(e) => onChange((prev) => ({ ...prev, receptorNumeroDocumento: e.target.value.replace(/\D/g, '').slice(0, 20) }))}
                            className={styles.input}
                        />
                    </div>

                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Comprobante y montos</h3>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label className={styles.label}>Tipo de comprobante</label>
                        <select
                            value={data.tipoComprobante}
                            onChange={(e) => onChange((prev) => ({ ...prev, tipoComprobante: Number(e.target.value) }))}
                            className={styles.select}
                            disabled={isComprobanteLocked}
                        >
                            {comprobanteOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        {comprobanteHelpText && <small className={styles.helpText}>{comprobanteHelpText}</small>}
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Punto de venta</label>
                        <input
                            type="number"
                            value={data.puntoVenta}
                            onChange={(e) => onChange((prev) => ({ ...prev, puntoVenta: Number(e.target.value || 0) }))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Importe total</label>
                        <input
                            type="number"
                            step="0.01"
                            value={data.importeTotal}
                            onChange={(e) => onChange((prev) => ({ ...prev, importeTotal: Number(e.target.value || 0) }))}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Importe neto</label>
                        <input
                            type="number"
                            step="0.01"
                            value={data.importeNeto}
                            onChange={(e) => onChange((prev) => ({ ...prev, importeNeto: Number(e.target.value || 0) }))}
                            className={styles.input}
                        />
                    </div>
                    {showIvaFields && (
                        <>
                            <div className={styles.field}>
                                <label className={styles.label}>Importe IVA</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={data.importeIVA}
                                    onChange={(e) => onChange((prev) => ({ ...prev, importeIVA: Number(e.target.value || 0) }))}
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Importe tributo</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={data.importeTributo}
                                    onChange={(e) => onChange((prev) => ({ ...prev, importeTributo: Number(e.target.value || 0) }))}
                                    className={styles.input}
                                />
                            </div>
                            <div className={`${styles.field} ${styles.fieldFull}`}>
                                <label className={styles.label}>IVA (previsualizacion JSON)</label>
                                <textarea
                                    value={JSON.stringify(data.ivaList, null, 2)}
                                    readOnly
                                    rows={6}
                                    className={styles.textarea}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.actions}>
                <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                    {cancelLabel}
                </Button>
                <Button onClick={onConfirm} isLoading={isSubmitting}>
                    {confirmLabel}
                </Button>
            </div>
        </div>
    );
};

export default FiscalVoucherPreviewForm;
