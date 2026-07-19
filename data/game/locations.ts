import type { GameLocation } from "@/types/game";

/** Official GDS locations — weights 1 / 2 / 3 / 5 / 8. Cougars cannot select Home. */
export const GAME_LOCATIONS: GameLocation[] = [
  {
    id: 0,
    name: "Home",
    weight: 1,
    riskLabel: "None",
    /** Display % for base hunt penalty π₀ (Candidate A). */
    pressure: 0,
    alpacaAllowed: true,
    cougarAllowed: false,
    thumbnail: "/game/maps/home.png",
  },
  {
    id: 1,
    name: "Mountain",
    weight: 2,
    riskLabel: "Low",
    pressure: 15,
    alpacaAllowed: true,
    cougarAllowed: true,
    thumbnail: "/game/maps/mountain.png",
  },
  {
    id: 2,
    name: "Grassland",
    weight: 3,
    riskLabel: "Medium",
    pressure: 25,
    alpacaAllowed: true,
    cougarAllowed: true,
    thumbnail: "/game/maps/grassland.png",
  },
  {
    id: 3,
    name: "Forest",
    weight: 5,
    riskLabel: "High",
    pressure: 35,
    alpacaAllowed: true,
    cougarAllowed: true,
    thumbnail: "/game/maps/forest.png",
  },
  {
    id: 4,
    name: "River",
    weight: 8,
    riskLabel: "Extreme",
    pressure: 45,
    alpacaAllowed: true,
    cougarAllowed: true,
    thumbnail: "/game/maps/river.png",
  },
];
