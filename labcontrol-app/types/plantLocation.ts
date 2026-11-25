export type PlantLocationMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: "saved" | "pending" | "preview";
};
