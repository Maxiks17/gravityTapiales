/**
 * SKU Service Utilities
 * Funciones para generar y validar SKUs
 * 
 * Este archivo contiene la lógica que debería implementarse en el backend
 * o en el servicio de productos para manejar la generación de SKUs
 */

import type { SKUConfig, SKUGenerationMode, SKUGenerationResult } from '../types/sku';

/**
 * Servicio para generar y validar SKUs
 */
export class SKUService {
  /**
   * Genera un UUID corto de 6 caracteres
   */
  static generateUUIDShort(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Genera un SKU basado en la configuración y modo
   */
  static generateSKU(
    config: SKUConfig,
    mode?: SKUGenerationMode
  ): SKUGenerationResult {
    const generatedMode = mode || config.sku_generation_mode;
    const now = new Date();

    // Si la autogeneración está desactivada, no generar
    if (config.sku_auto_generate !== 'true') {
      throw new Error('SKU auto-generation is disabled');
    }

    let sku: string;
    let nextNumber: number | undefined;

    switch (generatedMode) {
      case 'sequential': {
        sku = config.sku_next_number;
        nextNumber = parseInt(config.sku_next_number, 10) + 1;
        break;
      }

      case 'prefixed_sequential': {
        const prefix = config.sku_prefix.toUpperCase();
        const paddedNum = String(config.sku_next_number).padStart(3, '0');
        sku = `${prefix}${paddedNum}`;
        nextNumber = parseInt(config.sku_next_number, 10) + 1;
        break;
      }

      case 'uuid_short': {
        sku = this.generateUUIDShort();
        break;
      }

      case 'manual': {
        throw new Error('Manual mode requires user input');
      }

      default: {
        throw new Error(`Unknown generation mode: ${generatedMode}`);
      }
    }

    return {
      sku,
      mode: generatedMode,
      generatedAt: now,
      nextNumber,
    };
  }

  /**
   * Incrementa el número de SKU siguiente en la configuración
   */
  static incrementNextNumber(config: SKUConfig): SKUConfig {
    const currentNum = parseInt(config.sku_next_number, 10);
    return {
      ...config,
      sku_next_number: String(currentNum + 1),
    };
  }

  /**
   * Valida que un SKU tenga el formato correcto
   */
  static validateSKUFormat(sku: string, config: SKUConfig): boolean {
    if (!sku || sku.length === 0) {
      return config.allow_products_without_sku === 'true';
    }

    const mode = config.sku_generation_mode;

    switch (mode) {
      case 'sequential': {
        // Solo números
        return /^\d+$/.test(sku);
      }

      case 'prefixed_sequential': {
        // Prefijo + números (min 4 caracteres: 1 letra + 3 números)
        const expectedPrefix = config.sku_prefix.toUpperCase();
        return sku.startsWith(expectedPrefix) && /^\d+$/.test(sku.substring(expectedPrefix.length));
      }

      case 'uuid_short': {
        // 6 caracteres alfanuméricos
        return /^[A-Z0-9]{6}$/.test(sku);
      }

      case 'manual': {
        // Cualquier formato es válido
        return true;
      }

      default: {
        return false;
      }
    }
  }

  /**
   * Obtiene sugerencias de corrección para un SKU inválido
   */
  static getSKUFormatSuggestions(sku: string, config: SKUConfig): string[] {
    const suggestions: string[] = [];
    const mode = config.sku_generation_mode;

    switch (mode) {
      case 'sequential': {
        if (!/^\d+$/.test(sku)) {
          suggestions.push(`SKU debe contener solo números, intenta: ${sku.replace(/\D/g, '')}`);
        }
        break;
      }

      case 'prefixed_sequential': {
        const prefix = config.sku_prefix.toUpperCase();
        if (!sku.startsWith(prefix)) {
          suggestions.push(`SKU debe comenzar con prefijo "${prefix}"`);
        }
        if (!/^\d+$/.test(sku.substring(prefix.length))) {
          const numPart = sku.substring(prefix.length).replace(/\D/g, '');
          suggestions.push(`Intenta: ${prefix}${numPart.padStart(3, '0')}`);
        }
        break;
      }

      case 'uuid_short': {
        if (!/^[A-Z0-9]{6}$/.test(sku)) {
          const cleaned = sku.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
          suggestions.push(`UUID debe ser 6 caracteres alfanuméricos, intenta: ${cleaned}`);
        }
        break;
      }
    }

    return suggestions;
  }

  /**
   * Convierte un SKU a su forma canónica (normalizada)
   */
  static normalizeSKU(sku: string, config: SKUConfig): string {
    if (!sku) return sku;

    const mode = config.sku_generation_mode;

    switch (mode) {
      case 'prefixed_sequential':
        return sku.toUpperCase();
      case 'uuid_short':
        return sku.toUpperCase();
      default:
        return sku;
    }
  }

  /**
   * Compara dos SKUs considerando normalización
   */
  static compareSKU(sku1: string, sku2: string, config: SKUConfig): boolean {
    return this.normalizeSKU(sku1, config) === this.normalizeSKU(sku2, config);
  }

  /**
   * Analiza un SKU y retorna información sobre él
   */
  static analyzeSKU(sku: string, config: SKUConfig) {
    return {
      sku,
      normalized: this.normalizeSKU(sku, config),
      length: sku.length,
      isNumeric: /^\d+$/.test(sku),
      isAlphanumeric: /^[A-Z0-9]+$/i.test(sku),
      format: this.getFormatInfo(sku, config),
      isValid: this.validateSKUFormat(sku, config),
    };
  }

  /**
   * Obtiene información del formato de un SKU
   */
  private static getFormatInfo(sku: string, config: SKUConfig) {
    const mode = config.sku_generation_mode;

    switch (mode) {
      case 'sequential': {
        return {
          type: 'sequential',
          value: parseInt(sku, 10),
        };
      }

      case 'prefixed_sequential': {
        const prefix = config.sku_prefix.toUpperCase();
        const numPart = sku.substring(prefix.length);
        return {
          type: 'prefixed_sequential',
          prefix,
          number: parseInt(numPart, 10),
        };
      }

      case 'uuid_short': {
        return {
          type: 'uuid_short',
          value: sku,
        };
      }

      case 'manual': {
        return {
          type: 'manual',
          value: sku,
        };
      }

      default: {
        return {
          type: 'unknown',
          value: sku,
        };
      }
    }
  }

  /**
   * Genera múltiples SKUs (útil para imports)
   */
  static generateMultipleSKUs(
    config: SKUConfig,
    count: number
  ): SKUGenerationResult[] {
    const results: SKUGenerationResult[] = [];
    let currentConfig = { ...config };

    for (let i = 0; i < count; i++) {
      const result = this.generateSKU(currentConfig);
      results.push(result);
      currentConfig = this.incrementNextNumber(currentConfig);
    }

    return results;
  }

  /**
   * Valida que no haya SKUs duplicados en un array
   */
  static checkDuplicates(skus: string[], config: SKUConfig): string[] {
    const normalized = new Set<string>();
    const duplicates: string[] = [];

    for (const sku of skus) {
      const norm = this.normalizeSKU(sku, config);
      if (normalized.has(norm)) {
        duplicates.push(sku);
      }
      normalized.add(norm);
    }

    return duplicates;
  }

  /**
   * Genera un reporte de SKUs
   */
  static generateReport(skus: string[], config: SKUConfig) {
    return {
      total: skus.length,
      unique: new Set(skus.map(s => this.normalizeSKU(s, config))).size,
      duplicates: this.checkDuplicates(skus, config),
      empty: skus.filter(s => !s || s.trim() === '').length,
      valid: skus.filter(s => this.validateSKUFormat(s, config)).length,
      analysis: skus.map(s => this.analyzeSKU(s, config)),
    };
  }
}

/**
 * Manejo de errores para SKU
 */
export class SKUError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SKUError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Códigos de error específicos para SKU
 */
export const SKU_ERROR_CODES = {
  AUTO_GENERATION_DISABLED: 'SKU_AUTO_GENERATION_DISABLED',
  INVALID_MODE: 'SKU_INVALID_MODE',
  INVALID_FORMAT: 'SKU_INVALID_FORMAT',
  DUPLICATE_SKU: 'SKU_DUPLICATE',
  SKU_REQUIRED: 'SKU_REQUIRED',
  INVALID_PREFIX: 'SKU_INVALID_PREFIX',
  INVALID_NUMBER: 'SKU_INVALID_NUMBER',
} as const;
