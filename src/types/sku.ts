/**
 * SKU Configuration Types
 * Tipos para la configuración de autogeneración de SKUs en productos
 */

/**
 * Modos disponibles para generar SKUs automáticamente
 */
export type SKUGenerationMode = 
  | 'sequential'           // 1, 2, 3, 4...
  | 'prefixed_sequential'  // DIST001, DIST002...
  | 'manual'               // Ingreso manual requerido
  | 'uuid_short';          // A7F2E1, B9K3C7...

/**
 * Configuración de SKU para un tenant
 */
export interface SKUConfig {
  /** Activar/desactivar autogeneración de SKU */
  sku_auto_generate: 'true' | 'false';
  
  /** Modo de generación automática */
  sku_generation_mode: SKUGenerationMode;
  
  /** Prefijo para modo prefixed_sequential (máx 5 caracteres) */
  sku_prefix: string;
  
  /** Próximo número a usar en generación secuencial */
  sku_next_number: string;
  
  /** Permite crear productos sin SKU */
  allow_products_without_sku: 'true' | 'false';
  
  /** Requiere SKU único en la base de datos */
  require_unique_sku: 'true' | 'false';
}

/**
 * Configuración completa de settings de un tenant
 */
export interface TenantSettings extends SKUConfig {
  // AFIP Configuration
  afip_environment: 'test' | 'production';
  afip_certificate_private_key: string;
  afip_taxpayer_type: 'monotributo' | 'responsable_inscripto';
  afip_punto_venta: string;
  
  // Inventory
  control_stock: 'true' | 'false';
  
  // Printing
  print_endpoint: string;
  auto_print_pos: 'true' | 'false';
  
  // Additional company info
  company_cuit?: string;
}

/**
 * Parámetros para generar un SKU
 */
export interface SKUGenerationParams {
  tenantId: string;
  productName?: string;
  productId?: string;
}

/**
 * Resultado de la generación de SKU
 */
export interface SKUGenerationResult {
  sku: string;
  mode: SKUGenerationMode;
  generatedAt: Date;
  nextNumber?: number;
}

/**
 * Validación de SKU
 */
export interface SKUValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Descripción de un modo de generación
 */
export interface SKUModeDescription {
  mode: SKUGenerationMode;
  label: string;
  description: string;
  example: string;
  requiresPrefix: boolean;
  requiresNumber: boolean;
}

/**
 * Configuraciones de ejemplo para diferentes casos de uso
 */
export const SKU_PRESETS = {
  DISTRIBUTOR: {
    sku_auto_generate: 'true',
    sku_generation_mode: 'prefixed_sequential' as SKUGenerationMode,
    sku_prefix: 'DIST',
    sku_next_number: '1001',
    allow_products_without_sku: 'false',
    require_unique_sku: 'true',
  } as SKUConfig,
  
  RETAIL: {
    sku_auto_generate: 'false',
    sku_generation_mode: 'manual' as SKUGenerationMode,
    sku_prefix: '',
    sku_next_number: '1',
    allow_products_without_sku: 'true',
    require_unique_sku: 'true',
  } as SKUConfig,
  
  DIGITAL: {
    sku_auto_generate: 'true',
    sku_generation_mode: 'uuid_short' as SKUGenerationMode,
    sku_prefix: '',
    sku_next_number: '1',
    allow_products_without_sku: 'false',
    require_unique_sku: 'true',
  } as SKUConfig,
  
  SIMPLE: {
    sku_auto_generate: 'true',
    sku_generation_mode: 'sequential' as SKUGenerationMode,
    sku_prefix: '',
    sku_next_number: '1',
    allow_products_without_sku: 'false',
    require_unique_sku: 'true',
  } as SKUConfig,
} as const;

/**
 * Descripciones de los modos de generación
 */
export const SKU_MODE_DESCRIPTIONS: Record<SKUGenerationMode, SKUModeDescription> = {
  sequential: {
    mode: 'sequential',
    label: 'Secuencial',
    description: 'Genera números simples: 1, 2, 3...',
    example: '1, 2, 3, 100',
    requiresPrefix: false,
    requiresNumber: true,
  },
  prefixed_sequential: {
    mode: 'prefixed_sequential',
    label: 'Prefijo + Secuencial',
    description: 'Combina prefijo con número: PREF001, PREF002...',
    example: 'DIST001, DIST002, DIST100',
    requiresPrefix: true,
    requiresNumber: true,
  },
  manual: {
    mode: 'manual',
    label: 'Manual',
    description: 'Requiere ingreso manual de cada SKU',
    example: 'ABC-123, XYZ-789',
    requiresPrefix: false,
    requiresNumber: false,
  },
  uuid_short: {
    mode: 'uuid_short',
    label: 'UUID Corto',
    description: 'Genera identificadores únicos aleatorios: A7F2E1...',
    example: 'A7F2E1, B9K3C7, X2M8N4',
    requiresPrefix: false,
    requiresNumber: false,
  },
} as const;

/**
 * Valores por defecto para SKU Configuration
 */
export const DEFAULT_SKU_CONFIG: SKUConfig = {
  sku_auto_generate: 'false',
  sku_generation_mode: 'sequential',
  sku_prefix: '',
  sku_next_number: '1',
  allow_products_without_sku: 'true',
  require_unique_sku: 'true',
} as const;

/**
 * Utilidades para trabajar con SKUs
 */
export const SKUUtils = {
  /**
   * Convierte una cadena a booleano
   */
  stringToBoolean(value: 'true' | 'false'): boolean {
    return value === 'true';
  },

  /**
   * Convierte un booleano a cadena
   */
  booleanToString(value: boolean): 'true' | 'false' {
    return value ? 'true' : 'false';
  },

  /**
   * Valida que el prefijo sea válido
   */
  isValidPrefix(prefix: string): boolean {
    return prefix.length > 0 && prefix.length <= 5 && /^[A-Z0-9]+$/.test(prefix);
  },

  /**
   * Valida que el número sea válido
   */
  isValidNumber(num: string): boolean {
    const n = parseInt(num, 10);
    return !isNaN(n) && n >= 1;
  },

  /**
   * Genera un vista previa del SKU según la configuración
   */
  generatePreview(config: Partial<SKUConfig>): string {
    const mode = config.sku_generation_mode || 'sequential';
    
    switch (mode) {
      case 'sequential': {
        return `SKU #${config.sku_next_number || '1'}`;
      }

      case 'prefixed_sequential': {
        const prefix = config.sku_prefix || 'PREF';
        const num = String(config.sku_next_number || '1').padStart(3, '0');
        return `${prefix}${num}`;
      }

      case 'uuid_short': {
        return 'Se generará un UUID aleatorio';
      }

      case 'manual': {
        return 'Se solicitará manualmente en cada producto';
      }

      default: {
        return 'Configuración inválida';
      }
    }
  },

  /**
   * Valida la configuración completa
   */
  validateConfig(config: Partial<SKUConfig>): SKUValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar si está activada la autogeneración
    if (config.sku_auto_generate === 'true') {
      // Validar modo
      if (!config.sku_generation_mode) {
        errors.push('Modo de generación no especificado');
      }

      // Validar modo prefixed_sequential
      if (config.sku_generation_mode === 'prefixed_sequential') {
        if (!config.sku_prefix || !this.isValidPrefix(config.sku_prefix)) {
          errors.push('Prefijo inválido (máx 5 caracteres alfanuméricos)');
        }
        if (!config.sku_next_number || !this.isValidNumber(config.sku_next_number)) {
          errors.push('Número de inicio inválido');
        }
      }

      // Validar modo sequential
      if (config.sku_generation_mode === 'sequential') {
        if (!config.sku_next_number || !this.isValidNumber(config.sku_next_number)) {
          errors.push('Número de inicio inválido');
        }
      }
    }

    // Validar restricciones
    if (config.allow_products_without_sku === 'false' && config.require_unique_sku === 'false') {
      warnings.push('Todos los productos requieren SKU pero se permiten duplicados (no recomendado)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },
};
