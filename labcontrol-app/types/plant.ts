export interface Plant {
    id: string;
    userId: string;
    name: string;
    description: string;
    scale: number;
    widthUnits: number;
    heightUnits: number;
    latitude?: number | null;
    longitude?: number | null;
    createdAt: string;
    updatedAt: string;
}