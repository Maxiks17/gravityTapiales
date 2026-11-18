/**
 * Invoice Builder - Builder pattern for creating AFIP FECAERequest objects
 * Ported from afip_wsfev1/Factura.cs - FECAERequestBuilder + EjemplosFacturacion
 */

import { CondicionIVA, TipoComprobante, TipoConcepto } from './constants';
import type { FECAERequest, FECabRequest, FECAEDetRequest, AlicIva, Tributo, CbteAsoc, Opcional } from './types';

// ─── FECAEDetRequest Builder ─────────────────────────────────────────────────────

export class FECAEDetRequestBuilder {
  private parent: FECAERequestBuilder;
  private detalle: FECAEDetRequest;
  private ivaList: AlicIva[] = [];
  private tributosList: Tributo[] = [];
  private cbtesAsocList: CbteAsoc[] = [];
  private opcionalesList: Opcional[] = [];

  constructor(parent: FECAERequestBuilder) {
    this.parent = parent;
    this.detalle = {
      concepto: 0,
      docTipo: 0,
      docNro: 0,
      cbteDesde: 0,
      cbteHasta: 0,
      cbteFch: '',
      impTotal: 0,
      impNeto: 0,
      impIVA: 0,
      impOpEx: 0,
      impTotConc: 0,
      impTrib: 0,
      monId: 'PES',
      monCotiz: 1,
      condicionIVAReceptorId: 0,
      iva: [],
    };
  }

  /**
   * Set basic voucher information
   */
  conDatosBasicos(
    concepto: number,
    tipoDoc: number,
    nroDoc: number,
    comprobanteDesde: number,
    comprobanteHasta: number,
    fechaComprobante: string
  ): FECAEDetRequestBuilder {
    this.detalle.concepto = concepto;
    this.detalle.docTipo = tipoDoc;
    this.detalle.docNro = nroDoc;
    this.detalle.cbteDesde = comprobanteDesde;
    this.detalle.cbteHasta = comprobanteHasta;
    this.detalle.cbteFch = fechaComprobante;
    return this;
  }

  /**
   * Set service dates (required when concepto = 2 or 3)
   */
  conFechasServicio(
    fechaDesde: string,
    fechaHasta: string,
    fechaVencimiento?: string
  ): FECAEDetRequestBuilder {
    this.detalle.fchServDesde = fechaDesde;
    this.detalle.fchServHasta = fechaHasta;
    if (fechaVencimiento) {
      this.detalle.fchVtoPago = fechaVencimiento;
    }
    return this;
  }

  /**
   * Set all voucher amounts
   */
  conImportes(
    importeTotal: number,
    importeNeto: number,
    importeIVA: number,
    importeExento: number = 0,
    importeNoGravado: number = 0,
    importeTributos: number = 0
  ): FECAEDetRequestBuilder {
    this.detalle.impTotal = importeTotal;
    this.detalle.impNeto = importeNeto;
    this.detalle.impIVA = importeIVA;
    this.detalle.impOpEx = importeExento;
    this.detalle.impTotConc = importeNoGravado;
    this.detalle.impTrib = importeTributos;
    return this;
  }

  /**
   * Set currency information
   */
  conMoneda(monedaId: string, cotizacion: number = 1): FECAEDetRequestBuilder {
    this.detalle.monId = monedaId;
    this.detalle.monCotiz = cotizacion;
    return this;
  }

  /**
   * Set recipient IVA condition
   */
  conCondicionIVAReceptor(condicionIVA: number): FECAEDetRequestBuilder {
    this.detalle.condicionIVAReceptorId = condicionIVA;
    return this;
  }

  /**
   * Add an IVA rate
   * @param ivaId - IVA ID (3=0%, 4=10.5%, 5=21%, 6=27%)
   * @param baseImponible - Taxable base
   * @param importe - IVA amount
   */
  agregarIVA(ivaId: number, baseImponible: number, importe: number): FECAEDetRequestBuilder {
    this.ivaList.push({ id: ivaId, baseImp: baseImponible, importe });
    return this;
  }

  /**
   * Add a tribute
   */
  agregarTributo(
    tributoId: number,
    descripcion: string,
    baseImponible: number,
    alicuota: number,
    importe: number
  ): FECAEDetRequestBuilder {
    this.tributosList.push({
      id: tributoId,
      desc: descripcion,
      baseImp: baseImponible,
      alic: alicuota,
      importe,
    });
    return this;
  }

  /**
   * Add an associated voucher (for credit/debit notes)
   */
  agregarComprobanteAsociado(
    tipo: number,
    puntoVenta: number,
    numero: number,
    cuit?: string,
    fecha?: string
  ): FECAEDetRequestBuilder {
    this.cbtesAsocList.push({ tipo, ptoVta: puntoVenta, nro: numero, cuit, cbteFch: fecha });
    return this;
  }

  /**
   * Add an optional field
   */
  agregarCampoOpcional(id: string, valor: string): FECAEDetRequestBuilder {
    this.opcionalesList.push({ id, valor });
    return this;
  }

  /**
   * Finalize the detail and return to parent builder
   */
  finalizarDetalle(): FECAERequestBuilder {
    this.detalle.iva = this.ivaList.length > 0 ? [...this.ivaList] : [];
    if (this.tributosList.length > 0) this.detalle.tributos = [...this.tributosList];
    if (this.cbtesAsocList.length > 0) this.detalle.cbtesAsoc = [...this.cbtesAsocList];
    if (this.opcionalesList.length > 0) this.detalle.opcionales = [...this.opcionalesList];

    this.validarDetalle();
    this.parent.agregarDetalleInterno(this.detalle);
    return this.parent;
  }

  private validarDetalle(): void {
    if (this.detalle.concepto === 0)
      throw new Error('Concepto is required. Call conDatosBasicos() first.');
    if (this.detalle.cbteDesde === 0 || this.detalle.cbteHasta === 0)
      throw new Error('Voucher numbers are required.');
    if (!this.detalle.cbteFch)
      throw new Error('Voucher date is required.');
    if ((this.detalle.concepto === 2 || this.detalle.concepto === 3) &&
        (!this.detalle.fchServDesde || !this.detalle.fchServHasta))
      throw new Error('Service dates are required when concepto is 2 or 3.');
    if (this.detalle.impTotal === 0)
      throw new Error('Total amount must be greater than 0.');
  }
}

// ─── FECAERequest Builder ────────────────────────────────────────────────────────

export class FECAERequestBuilder {
  private cabecera: FECabRequest | null = null;
  private detalles: FECAEDetRequest[] = [];

  /**
   * Create the request header
   */
  crearCabecera(cantidadRegistros: number, puntoVenta: number, tipoComprobante: number): FECAERequestBuilder {
    this.cabecera = {
      cantReg: cantidadRegistros,
      ptoVta: puntoVenta,
      cbteTipo: tipoComprobante,
    };
    return this;
  }

  /**
   * Start adding a new detail
   */
  agregarDetalle(): FECAEDetRequestBuilder {
    return new FECAEDetRequestBuilder(this);
  }

  /**
   * Internal: add a completed detail
   */
  agregarDetalleInterno(detalle: FECAEDetRequest): void {
    this.detalles.push(detalle);
  }

  /**
   * Build the final FECAERequest
   */
  construir(): FECAERequest {
    if (!this.cabecera)
      throw new Error('Header must be created before building. Call crearCabecera() first.');
    if (this.detalles.length === 0)
      throw new Error('At least one detail must be added.');
    if (this.cabecera.cantReg !== this.detalles.length)
      throw new Error(`Header CantReg (${this.cabecera.cantReg}) does not match details count (${this.detalles.length}).`);

    return {
      feCabReq: this.cabecera,
      feDetReq: [...this.detalles],
    };
  }
}

// ─── Factory functions (equivalent to EjemplosFacturacion in .NET) ───────────────

/**
 * Create a simple invoice
 * Equivalent to EjemplosFacturacion.CrearFacturaSimple in .NET
 */
export function crearFacturaSimple(
  puntoVenta: number,
  numeroComprobante: number,
  tipoComprobante: number,
  fechaComprobante: Date | string,
  tipoConcepto: number,
  tipoDocCliente: number,
  dniCliente: number,
  importeTotal: number,
  importeNeto: number,
  importeIVA: number,
  moneda: string,
  cotizacion: number,
  ivaList: AlicIva[]
): FECAERequest {
  // Validate IVA list for non-C invoices
  if (tipoComprobante !== TipoComprobante.FacturaC && (!ivaList || ivaList.length === 0)) {
    throw new Error('At least one IVA rate must be provided in ivaList.');
  }

  const fechaStr = typeof fechaComprobante === 'string'
    ? fechaComprobante.replace(/-/g, '').substring(0, 8)
    : formatDate(fechaComprobante);

  const builder = new FECAERequestBuilder()
    .crearCabecera(1, puntoVenta, tipoComprobante);

  const detalleBuilder = builder.agregarDetalle()
    .conDatosBasicos(tipoConcepto, tipoDocCliente, dniCliente, numeroComprobante, numeroComprobante, fechaStr)
    .conImportes(importeTotal, importeNeto, importeIVA)
    .conMoneda(moneda, cotizacion)
    .conCondicionIVAReceptor(CondicionIVA.ConsumidorFinal);

  // Add IVA rates (skip for Factura C)
  for (const iva of ivaList) {
    if (tipoComprobante !== TipoComprobante.FacturaC) {
      detalleBuilder.agregarIVA(iva.id, iva.baseImp, iva.importe);
    }
  }

  return detalleBuilder
    .finalizarDetalle()
    .construir();
}

/**
 * Create a credit note
 * Equivalent to EjemplosFacturacion.CrearNotaCredito in .NET
 */
export function crearNotaCredito(
  puntoVenta: number,
  numeroNotaCredito: number,
  tipoComprobante: number,
  fechaComprobante: Date | string,
  tipoFacturaOriginal: number,
  puntoVentaOriginal: number,
  numeroFacturaOriginal: number,
  tipoDoc: number,
  nroDoc: number,
  importeTotal: number,
  importeNeto: number,
  importeIVA: number,
  moneda: string,
  cotizacion: number,
  ivaList: AlicIva[]
): FECAERequest {
  const fechaStr = typeof fechaComprobante === 'string'
    ? fechaComprobante.replace(/-/g, '').substring(0, 8)
    : formatDate(fechaComprobante);

  const builder = new FECAERequestBuilder()
    .crearCabecera(1, puntoVenta, tipoComprobante);

  const detalleBuilder = builder.agregarDetalle()
    .conDatosBasicos(TipoConcepto.Productos, tipoDoc, nroDoc, numeroNotaCredito, numeroNotaCredito, fechaStr)
    .conImportes(importeTotal, importeNeto, importeIVA)
    .conMoneda(moneda, cotizacion)
    .conCondicionIVAReceptor(CondicionIVA.ConsumidorFinal);

  for (const iva of ivaList) {
    detalleBuilder.agregarIVA(iva.id, iva.baseImp, iva.importe);
  }

  return detalleBuilder
    .agregarComprobanteAsociado(tipoFacturaOriginal, puntoVentaOriginal, numeroFacturaOriginal)
    .finalizarDetalle()
    .construir();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
