// ─── PLANT ────────────────────────────────────────────────────────────────────
export interface Plant {
    id: string;
    name: string;
    description: string;
}

// ─── SECTOR ───────────────────────────────────────────────────────────────────
export interface SectorPoint {
    X: number;
    Y: number;
}

export interface Sector {
    id: string;
    plantId: string;
    name: string;
    type: string;
    color: string;
    pointsJson: string;
    points: SectorPoint[]; // parsed from pointsJson
}

// ─── MACHINE ──────────────────────────────────────────────────────────────────
export type MachineStatus = "active" | "warning" | "error" | "idle";

export interface Machine {
    id: string;
    plantId: string;
    sectorId: string;
    name: string;
    model: string;
    posX: number;
    posY: number;
    status: MachineStatus;
}

// ─── CANVAS ───────────────────────────────────────────────────────────────────

/** Pre-computed bounding box used to centre all content on the SVG canvas */
export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    rawW: number;
    rawH: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    svgW: number;
    svgH: number;
}