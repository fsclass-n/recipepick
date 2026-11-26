// Unsplash 이미지(Unsplash License, 핫링크 허용). 모든 ID는 실제 응답(200)과 피사체를 확인한 것만 사용.
export const unsplash = (id, w = 1200, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}${h ? `&h=${h}` : ""}`;

export const IMG = {
  bibimbap: "1590301157890-4810ed352733",
  buddhaBowl: "1512621776951-a57141f2eefd",
  eggBowl: "1490645935967-10de6ba17061",
  salmonBowl: "1546069901-ba9599a7e63c",
  salmonPlate: "1519708227418-c8fd9a32b7a2",
  salmonFillet: "1467003909585-2f8a72700288",
  greenSalad: "1540189549336-e6e99c3679fe",
  berrySalad: "1505253716362-afaea1d3d1af",
  grainBowl: "1547592180-85f173990554",
  breakfast: "1494390248081-4e521a5940db",
  greensPlate: "1511690743698-d9d85f2fbf38",
  greenBowl: "1484980972926-edee96e0960d",
  pokeBowl: "1547496502-affa22d38842",
  mealPrep: "1498837167922-ddd27525d352",
  market: "1488459716781-31db52582fe9",
  groceryShelf: "1542838132-92c53300491e",
  retroFridge: "1571175443880-49e1d25b2bc5",
  cooking: "1556910103-1c02745aae4d",
  curry: "1455619452474-d2be8b1e70cd",
  tableSpread: "1504674900247-0877df9cc836",
};
