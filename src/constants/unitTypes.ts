export interface UnitType {
    code: string;
    name: string;
    allows_decimals: boolean;
}

export const UNIT_TYPES: Record<string, UnitType> = {
    unit:  { code: 'unit',  name: 'Unidad',    allows_decimals: false },
    kg:    { code: 'kg',    name: 'Kilogramo',  allows_decimals: true },
    gr:    { code: 'gr',    name: 'Gramo',      allows_decimals: true },
    liter: { code: 'liter', name: 'Litro',      allows_decimals: true },
    ml:    { code: 'ml',    name: 'Mililitro',  allows_decimals: true },
} as const;

export const UNIT_TYPES_LIST: UnitType[] = Object.values(UNIT_TYPES);
