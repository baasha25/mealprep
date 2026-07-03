// Kitchen station routing — which station cooks which diet. Shared by the
// production report, the KDS board, and the seed so they always agree.

export const STATIONS = ["Grill", "Sauté", "Cold Station", "Prep"] as const;
export type Station = (typeof STATIONS)[number];

const DIET_TO_STATION: Record<string, Station> = {
  "High Protein": "Grill",
  Keto: "Grill",
  "Low Carb": "Sauté",
  "Plant-Based": "Cold Station",
};

export function stationFor(diet: string | null | undefined): Station {
  return (diet && DIET_TO_STATION[diet]) || "Prep";
}
