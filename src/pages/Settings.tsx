import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { tenantService } from '../services/tenantService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../context/ToastContext';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import styles from './Settings.module.css';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import type { OperationMode } from '../types/operationMode';
import { EncryptionService } from '../services/encryptionService';

const Settings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { currentTenant, isFirstLogin, refreshTenant } = useTenant();
    const { showToast } = useToast();
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        cuit: '',
    });
    const [settings, setSettings] = useState({
        afip_environment: 'test',
        afip_certificate_private_key: '',
        afip_taxpayer_type: 'monotributo',
        afip_punto_venta: '1',
        afip_certificate: '',
        control_stock: 'true',
        print_endpoint: 'http://localhost:3001/imprimirTicket',
        auto_print_pos: 'false',
        print_separate_by_category: 'false',
        // SKU Configuration
        sku_auto_generate: 'false',
        sku_generation_mode: 'sequential',
        sku_prefix: '',
        sku_next_number: '1',
        allow_products_without_sku: 'true',
        require_unique_sku: 'true',
        // Operation Mode
        operation_mode: 'KIOSCO' as OperationMode,
    });
    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
    const encryptionService = new EncryptionService(import.meta.env.ENCRYPTION_KEY);

    useEffect(() => {
        loadSettings();
    }, [currentTenant]);

    const loadSettings = async () => {
        try {
            // Load tenant/company info
            if (currentTenant) {
                // Get settings from tenant
                const settingsData = await tenantService.getSettings(currentTenant.id);

                setCompanyInfo({
                    name: currentTenant.name || '',
                    email: currentTenant.email || '',
                    phone: currentTenant.phone || '',
                    address: currentTenant.address || '',
                    cuit: settingsData.company_cuit || '',
                });

                // Load other settings
                const newSettings = { ...settings };
                Object.keys(settingsData).forEach(key => {
                    if (key in newSettings) {
                        // Handle boolean strings if necessary, though JSONB stores types
                        (newSettings as any)[key] = settingsData[key];
                    }
                });
                setSettings(newSettings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };
  
    const handleCompanyChange = (key: string, value: string) => {
        setCompanyInfo(prev => ({ ...prev, [key]: value }));
    };

    const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const validExtensions = ['.crt', '.pem', '.cer'];
        const isValidFile = validExtensions.some(ext => file?.name.toLowerCase().endsWith(ext));
        
        if (file && isValidFile) {
            setCertificateFile(file);
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const result = event.target?.result as string;
                // Extract base64 part from data URL
                const base64 = result.split(',')[1];

                // Convertir Base64 a Bytes
                const binaryString = window.atob(base64);
                const len = binaryString.length;    
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const encrypted = await encryptionService.encryptBytes(bytes);
                handleChange('afip_certificate', encrypted);
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Por favor selecciona un archivo de certificado válido (.crt, .pem, .cer)', 'error');
        }
    };

    const handlePrivateKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const validExtensions = ['.key', '.pem'];
        const isValidFile = validExtensions.some(ext => file?.name.toLowerCase().endsWith(ext));
        
        if (file && isValidFile) {
            setPrivateKeyFile(file);
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const result = event.target?.result as string;
                // Extract base64 part from data URL
                const base64 = result.split(',')[1];

                // Convertir Base64 a Bytes
                const binaryString = window.atob(base64);
                const len = binaryString.length;    
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const encrypted = await encryptionService.encryptBytes(bytes);
                handleChange('afip_certificate_private_key', encrypted);
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Por favor selecciona un archivo de clave privada válido (.key, .pem)', 'error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Validate required fields
            if (isFirstLogin && !companyInfo.name.trim()) {
                showToast('Por favor ingresa el nombre de tu empresa', 'error');
                setSaving(false);
                return;
            }

            // Update tenant info (company basic info)
            if (currentTenant) {
                if (isFirstLogin) {
                    await tenantService.completeSetup(currentTenant.id, {
                        name: companyInfo.name,
                        email: companyInfo.email,
                        phone: companyInfo.phone,
                        address: companyInfo.address,
                    });
                    await refreshTenant();
                } else {
                    await tenantService.update(currentTenant.id, {
                        name: companyInfo.name,
                        email: companyInfo.email,
                        phone: companyInfo.phone,
                        address: companyInfo.address,
                    });
                    // Refresh tenant context to update the UI immediately
                    await refreshTenant();
                }

                let privateKeyToSave = settings.afip_certificate_private_key;
                if (currentTenant.settings?.afip_certificate_private_key !== settings.afip_certificate_private_key) {
                    // If private key changed, it's already encrypted from file upload
                    privateKeyToSave = settings.afip_certificate_private_key;
                }

                // Save application settings including CUIT
                const settingsToSave = {
                    ...settings,
                    afip_certificate_private_key: privateKeyToSave,
                    company_cuit: companyInfo.cuit
                };

                await tenantService.updateSettings(currentTenant.id, settingsToSave);
                
                // Clear operation mode cache to force reload
                sessionStorage.removeItem(`operation_mode_${currentTenant.id}`);
            }

            showToast('¡Configuración guardada exitosamente!', 'success');

            // If it was first login, reload to update the UI
            if (isFirstLogin) {
                window.location.reload();
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Error al guardar la configuración.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout title={isFirstLogin ? "Configuración Inicial" : "Configuración del Sistema"}>
                <LoadingPlaceholder />
            </Layout>
        );
    }

    return (
        <Layout title={isFirstLogin ? "Configuración Inicial" : "Configuración del Sistema"}>
            <FadeIn>
                <div className={styles.container}>
                    {isFirstLogin && (
                        <div style={{
                            padding: '1.5rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: '8px',
                            marginBottom: '2rem'
                        }}>
                            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>¡Bienvenido!</h2>
                            <p style={{ margin: 0 }}>
                                Completa la información de tu distribuidora para comenzar a usar el sistema.
                                Podrás modificar estos datos en cualquier momento.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSave}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                {isFirstLogin ? 'Información de tu Empresa (Requerido)' : 'Información de la Empresa'}
                            </h2>
                            <div className={styles.form}>
                                <Input
                                    label="Nombre de la Empresa *"
                                    value={companyInfo.name}
                                    onChange={(e) => handleCompanyChange('name', e.target.value)}
                                    required={isFirstLogin}
                                    placeholder="Ej: Distribuidora San Martín"
                                />
                                <Input
                                    label="Email de Contacto"
                                    type="email"
                                    value={companyInfo.email}
                                    onChange={(e) => handleCompanyChange('email', e.target.value)}
                                    placeholder="contacto@empresa.com"
                                />
                                <div className={styles.formRow}>
                                    <Input
                                        label="Teléfono"
                                        value={companyInfo.phone}
                                        onChange={(e) => handleCompanyChange('phone', e.target.value)}
                                        placeholder="Ej: +54 9 11 1234-5678"
                                    />
                                    <Input
                                        label="CUIT / ID Fiscal"
                                        value={companyInfo.cuit}
                                        onChange={(e) => handleCompanyChange('cuit', e.target.value)}
                                        placeholder="XX-XXXXXXXX-X"
                                    />
                                </div>
                                <Input
                                    label="Dirección"
                                    value={companyInfo.address}
                                    onChange={(e) => handleCompanyChange('address', e.target.value)}
                                    placeholder="Ej: Av. San Martín 1234, CABA"
                                />
                            </div>
                        </div>

                        {!isFirstLogin && (
                            <>
                                {/* Operation Mode Section */}
                                <div className={styles.section}>
                                    <h2 className={styles.sectionTitle}>Modo de Operación</h2>
                                    <div className={styles.form}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Tipo de Negocio</label>
                                            <div className={styles.operationModeCards} style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: 'var(--spacing-md)',
                                                marginTop: 'var(--spacing-sm)',
                                            }}>
                                                <div 
                                                    className={styles.operationModeCard}
                                                    style={{
                                                        padding: 'var(--spacing-lg)',
                                                        border: `2px solid ${settings.operation_mode === 'RESTAURANTE' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                        borderRadius: 'var(--radius-lg)',
                                                        cursor: 'pointer',
                                                        backgroundColor: settings.operation_mode === 'RESTAURANTE' ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-bg-card)',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onClick={() => handleChange('operation_mode', 'RESTAURANTE')}
                                                >
                                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🍽️</div>
                                                    <h3 style={{ margin: '0 0 var(--spacing-xs) 0', color: 'var(--color-text-main)' }}>Restaurante</h3>
                                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                                        Gestión de mesas, órdenes abiertas y cierre de cuenta.
                                                    </p>
                                                </div>
                                                <div 
                                                    className={styles.operationModeCard}
                                                    style={{
                                                        padding: 'var(--spacing-lg)',
                                                        border: `2px solid ${settings.operation_mode === 'KIOSCO' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                        borderRadius: 'var(--radius-lg)',
                                                        cursor: 'pointer',
                                                        backgroundColor: settings.operation_mode === 'KIOSCO' ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-bg-card)',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onClick={() => handleChange('operation_mode', 'KIOSCO')}
                                                >
                                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🏪</div>
                                                    <h3 style={{ margin: '0 0 var(--spacing-xs) 0', color: 'var(--color-text-main)' }}>Kiosco / Retail</h3>
                                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                                        Venta directa sin mesas. Pedidos completados al instante.
                                                    </p>
                                                </div>
                                                <div 
                                                    className={styles.operationModeCard}
                                                    style={{
                                                        padding: 'var(--spacing-lg)',
                                                        border: `2px solid ${settings.operation_mode === 'DISTRIBUIDOR' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                        borderRadius: 'var(--radius-lg)',
                                                        cursor: 'pointer',
                                                        backgroundColor: settings.operation_mode === 'DISTRIBUIDOR' ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-bg-card)',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onClick={() => handleChange('operation_mode', 'DISTRIBUIDOR')}
                                                >
                                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🚚</div>
                                                    <h3 style={{ margin: '0 0 var(--spacing-xs) 0', color: 'var(--color-text-main)' }}>Distribuidor</h3>
                                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                                        Pedidos pendientes con confirmación de entrega.
                                                    </p>
                                                </div>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-md)', display: 'block' }}>
                                                El modo de operación determina el flujo de trabajo del punto de venta y las opciones disponibles en el menú.
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h2 className={styles.sectionTitle}>Facturación</h2>
                                    <div className={styles.form}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Entorno de Facturación</label>
                                            <div className={styles.switchContainer}>
                                                <button
                                                    type="button"
                                                    className={`${styles.switchButton} ${settings.afip_environment === 'test' ? styles.active : ''}`}
                                                    onClick={() => handleChange('afip_environment', 'test')}
                                                >
                                                    Prueba
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.switchButton} ${settings.afip_environment === 'production' ? styles.active : ''}`}
                                                    onClick={() => handleChange('afip_environment', 'production')}
                                                >
                                                    Producción
                                                </button>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                {settings.afip_environment === 'test'
                                                    ? 'Modo de prueba - Las facturas no son válidas'
                                                    : 'Modo producción - Las facturas son válidas ante AFIP/ARCA'}
                                            </small>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Tipo de Contribuyente</label>
                                            <select
                                                className={styles.select}
                                                value={settings.afip_taxpayer_type}
                                                onChange={(e) => handleChange('afip_taxpayer_type', e.target.value)}
                                            >
                                                <option value="monotributo">Monotributista</option>
                                                <option value="responsable_inscripto">Responsable Inscripto</option>
                                            </select>
                                        </div>

                                        <Input
                                            label="Punto de Venta"
                                            value={settings.afip_punto_venta}
                                            onChange={(e) => handleChange('afip_punto_venta', e.target.value)}
                                            type="number"
                                            min="1"
                                            max="9999"
                                            placeholder="1"
                                        />

                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Certificado Digital</label>
                                            <div className={styles.fileUpload}>
                                                <input
                                                    type="file"
                                                    accept=".crt,.pem,.cer"
                                                    onChange={handleCertificateUpload}
                                                    className={styles.fileInput}
                                                    id="certificate-upload"
                                                />
                                                <label htmlFor="certificate-upload" className={styles.fileLabel}>
                                                    {certificateFile ? certificateFile.name : 'Seleccionar certificado (.crt, .pem, .cer)'}
                                                </label>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                Certificado digital necesario para facturación electrónica con AFIP/ARCA
                                            </small>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Clave Privada</label>
                                            <div className={styles.fileUpload}>
                                                <input
                                                    type="file"
                                                    accept=".key,.pem"
                                                    onChange={handlePrivateKeyUpload}
                                                    className={styles.fileInput}
                                                    id="private-key-upload"
                                                />
                                                <label htmlFor="private-key-upload" className={styles.fileLabel}>
                                                    {privateKeyFile ? privateKeyFile.name : 'Seleccionar clave privada (.key, .pem)'}
                                                </label>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                Clave privada correspondiente al certificado digital
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h2 className={styles.sectionTitle}>Inventario / Productos</h2>
                                    <div className={styles.form}>
                                        <div className={styles.formGroup}>
                                            <div className={styles.checkboxGroup}>
                                                <label className={styles.checkboxLabel}>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.control_stock === 'true'}
                                                        onChange={(e) => handleChange('control_stock', e.target.checked ? 'true' : 'false')}
                                                    />
                                                    <span>Controlar stock de productos al generar órdenes</span>
                                                </label>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                Si está habilitado, el sistema verificará que hay suficiente stock antes de permitir la creación de órdenes.
                                                Si está deshabilitado, se podrán generar órdenes sin verificar disponibilidad de stock.
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h2 className={styles.sectionTitle}>Configuración de SKU</h2>
                                    <div className={styles.form}>
                                        {/* Auto-generate SKU Toggle */}
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Autogeneración de SKU</label>
                                            <div className={styles.switchContainer}>
                                                <button
                                                    type="button"
                                                    className={`${styles.switchButton} ${settings.sku_auto_generate === 'false' ? styles.active : ''}`}
                                                    onClick={() => handleChange('sku_auto_generate', 'false')}
                                                >
                                                    Desactivado
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.switchButton} ${settings.sku_auto_generate === 'true' ? styles.active : ''}`}
                                                    onClick={() => handleChange('sku_auto_generate', 'true')}
                                                >
                                                    Activado
                                                </button>
                                            </div>
                                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                Activar para generar automáticamente SKUs al crear productos, o desactivar para ingresar manualmente.
                                            </small>
                                        </div>

                                        {/* SKU Generation Mode (only shown when auto-generate is enabled) */}
                                        {settings.sku_auto_generate === 'true' && (
                                            <>
                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Modo de Generación de SKU</label>
                                                    <select
                                                        className={styles.select}
                                                        value={settings.sku_generation_mode}
                                                        onChange={(e) => handleChange('sku_generation_mode', e.target.value)}
                                                    >
                                                        <option value="sequential">Secuencial (1, 2, 3...)</option>
                                                        <option value="prefixed_sequential">Prefijo + Secuencial (PREF001, PREF002...)</option>
                                                        <option value="manual">Manual (ingresar manualmente)</option>
                                                        <option value="uuid_short">UUID Corto (A7F2E1...)</option>
                                                    </select>
                                                    <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                        Selecciona cómo se generarán automáticamente los SKUs.
                                                    </small>
                                                </div>

                                                {/* Next SKU Number */}
                                                <div className={styles.formGroup}>
                                                    <label className={styles.label}>Próximo SKU a Generar</label>
                                                    <div style={{ 
                                                        padding: 'var(--spacing-md)', 
                                                        backgroundColor: 'var(--color-bg-secondary)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: 'var(--color-text-main)',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.95rem'
                                                    }}>
                                                        {settings.sku_generation_mode === 'sequential' && `SKU #${settings.sku_next_number}`}
                                                        {settings.sku_generation_mode === 'prefixed_sequential' && `${settings.sku_prefix}${String(settings.sku_next_number).padStart(3, '0')}`}
                                                        {settings.sku_generation_mode === 'uuid_short' && 'Se generará un UUID aleatorio'}
                                                        {settings.sku_generation_mode === 'manual' && 'Se solicitará manualmente en cada producto'}
                                                    </div>
                                                </div>

                                                {/* SKU Prefix (only shown when prefixed_sequential is selected) */}
                                                {settings.sku_generation_mode === 'prefixed_sequential' && (
                                                    <Input
                                                        label="Prefijo de SKU"
                                                        value={settings.sku_prefix}
                                                        onChange={(e) => handleChange('sku_prefix', e.target.value.toUpperCase())}
                                                        placeholder="Ej: DIST, PRD, etc."
                                                        maxLength={5}
                                                    />
                                                )}

                                                {/* Next Number Input (for sequential modes) */}
                                                {(settings.sku_generation_mode === 'sequential' || settings.sku_generation_mode === 'prefixed_sequential') && (
                                                    <Input
                                                        label="Número de inicio"
                                                        type="number"
                                                        value={settings.sku_next_number}
                                                        onChange={(e) => handleChange('sku_next_number', e.target.value)}
                                                        min="1"
                                                        placeholder="1"
                                                    />
                                                )}
                                            </>
                                        )}

                                        {/* SKU Constraints */}
                                        <div style={{ 
                                            borderTop: '1px solid var(--color-border)',
                                            paddingTop: 'var(--spacing-md)',
                                            marginTop: 'var(--spacing-md)'
                                        }}>
                                            <div className={styles.formGroup}>
                                                <div className={styles.checkboxGroup}>
                                                    <label className={styles.checkboxLabel}>
                                                        <input
                                                            type="checkbox"
                                                            checked={settings.allow_products_without_sku === 'true'}
                                                            onChange={(e) => handleChange('allow_products_without_sku', e.target.checked ? 'true' : 'false')}
                                                        />
                                                        <span>Permitir productos sin SKU</span>
                                                    </label>
                                                </div>
                                                <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                    Si está deshabilitado, todos los productos deberán tener un SKU.
                                                </small>
                                            </div>

                                            <div className={styles.formGroup}>
                                                <div className={styles.checkboxGroup}>
                                                    <label className={styles.checkboxLabel}>
                                                        <input
                                                            type="checkbox"
                                                            checked={settings.require_unique_sku === 'true'}
                                                            onChange={(e) => handleChange('require_unique_sku', e.target.checked ? 'true' : 'false')}
                                                        />
                                                        <span>Requerir SKU único</span>
                                                    </label>
                                                </div>
                                                <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                                    Si está habilitado, no se permitirá crear dos productos con el mismo SKU.
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h2 className={styles.sectionTitle}>Impresión</h2>
                                    <div className={styles.form}>
                                        <div className={styles.formRow}>
                                            <Input
                                                label="Endpoint del Servicio de Impresión"
                                                value={settings.print_endpoint}
                                                onChange={(e) => handleChange('print_endpoint', e.target.value)}
                                                placeholder="http://localhost:3001/imprimirTicket"
                                            />
                                        </div>
                                        <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                            URL del servicio local de impresión de tickets. Asegúrate de que el servicio esté ejecutándose.
                                        </small>
                                        <div className={styles.formRow}>
                                            <div className={styles.checkboxGroup}>
                                                <label className={styles.checkboxLabel}>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.auto_print_pos === 'true'}
                                                        onChange={(e) => handleChange('auto_print_pos', e.target.checked ? 'true' : 'false')}
                                                    />
                                                    <span>Imprimir ticket automáticamente en Punto de Venta</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className={styles.formRow}>
                                            <div className={styles.checkboxGroup}>
                                                <label className={styles.checkboxLabel}>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.print_separate_by_category === 'true'}
                                                        onChange={(e) => handleChange('print_separate_by_category', e.target.checked ? 'true' : 'false')}
                                                    />
                                                    <span>Imprimir tickets separados por categoría</span>
                                                </label>
                                            </div>
                                           
                                        </div>
                                        <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                                            Si está habilitado, se imprimirá un ticket por cada categoría de productos. Si está deshabilitado, se imprimirá un único ticket con todos los productos.
                                        </small>
                                    </div>
                                </div>

                            </>
                        )}

                        <div className={styles.actions}>
                            <Button type="submit" isLoading={saving} size="md">
                                <Save size={16} style={{ marginRight: '0.5rem' }} />
                                {isFirstLogin ? 'Completar Configuración y Continuar' : 'Guardar Configuración'}
                            </Button>
                        </div>
                    </form>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Settings;
