export const QTY_PROFILES = {
  pain:    [{l:"½ tr.",m:0.5},{l:"1 tr.",m:1},{l:"2 tr.",m:2},{l:"3 tr.",m:3},{l:"4 tr.",m:4}],
  piece:   [{l:"½ pc",m:0.5},{l:"1 pc",m:1},{l:"2 pc",m:2},{l:"3 pc",m:3}],
  plat:    [{l:"¼ plat",m:0.25},{l:"½ plat",m:0.5},{l:"¾ plat",m:0.75},{l:"1 plat",m:1},{l:"1½ plat",m:1.5},{l:"2 plats",m:2}],
  soupe:   [{l:"½ bol",m:0.5},{l:"1 bol",m:1},{l:"1½ bol",m:1.5},{l:"2 bols",m:2}],
  feculent:[{l:"½ port.",m:0.5},{l:"1 port.",m:1},{l:"1½ port.",m:1.5},{l:"2 port.",m:2},{l:"3 port.",m:3}],
  fruit_u: [{l:"½ fruit",m:0.5},{l:"1 fruit",m:1},{l:"1½ fruit",m:1.5},{l:"2 fruits",m:2},{l:"3 fruits",m:3}],
  fruit_v: [{l:"¼ bol",m:0.25},{l:"½ bol",m:0.5},{l:"1 bol",m:1},{l:"1½ bol",m:1.5},{l:"2 bols",m:2}],
  boisson: [{l:"½ verre",m:0.5},{l:"1 verre",m:1},{l:"2 verres",m:2},{l:"3 verres",m:3}],
  sucre:   [{l:"½ pc",m:0.5},{l:"1 pc",m:1},{l:"2 pc",m:2},{l:"3 pc",m:3},{l:"4 pc",m:4}],
  grasse:  [{l:"½ c.",m:0.5},{l:"1 c.",m:1},{l:"2 c.",m:2},{l:"3 c.",m:3}],
  legume:  [{l:"½ port.",m:0.5},{l:"1 port.",m:1},{l:"2 port.",m:2},{l:"3 port.",m:3}],
  viande:  [{l:"½ port.",m:0.5},{l:"1 port.",m:1},{l:"1½ port.",m:1.5},{l:"2 port.",m:2}],
  oeuf:    [{l:"1 œuf",m:1},{l:"2 œufs",m:2},{l:"3 œufs",m:3},{l:"4 œufs",m:4}],
  laitage: [{l:"½ pot",m:0.5},{l:"1 pot",m:1},{l:"2 pots",m:2}],
  gramme:  [{l:"50g",m:0.5},{l:"100g",m:1},{l:"150g",m:1.5},{l:"200g",m:2},{l:"250g",m:2.5},{l:"300g",m:3}],
};

export const DIGESTION_PROFILES = {
  rapide:   {label:"Rapide",   desc:"Estomac vide, liquides, sucres simples", icon:"⚡", peakMin:30,  tail:120, fatDelay:0  },
  normal:   {label:"Normal",   desc:"Repas standard équilibré",               icon:"🔄", peakMin:60,  tail:180, fatDelay:30 },
  lent:     {label:"Lent",     desc:"Repas riche, gras, fibres ++",           icon:"🐢", peakMin:90,  tail:240, fatDelay:60 },
  tres_lent:{label:"Très lent",desc:"Tajine/couscous complet, fête",          icon:"🏔", peakMin:120, tail:300, fatDelay:90 },
};

export const FAT_SCORE  = {"aucun":0,"faible":1,"moyen":2,"élevé":3};
export const FAT_FACTOR = {"aucun":0,"faible":0.04,"moyen":0.14,"élevé":0.27};

export const AGE_PROFILES = {
  enfant:  { label: "Enfant (< 12 ans)",   tddRange: [0.7, 1.0], icrRule: 300, isfRule: 2000 },
  ado:     { label: "Ado (12-18 ans)",      tddRange: [0.8, 1.2], icrRule: 400, isfRule: 1500 },
  adulte:  { label: "Adulte (18-65 ans)",   tddRange: [0.4, 0.6], icrRule: 500, isfRule: 1700 },
  senior:  { label: "Senior (> 65 ans)",    tddRange: [0.3, 0.5], icrRule: 600, isfRule: 2000 },
};

export function getAgeGroup(age) {
  if (!age || age < 1) return "adulte";
  if (age < 12) return "enfant";
  if (age < 18) return "ado";
  if (age > 65) return "senior";
  return "adulte";
}

// V4 NEW: Meal type constants
export const MEAL_TYPES = [
  { key: "petit-dejeuner", icon: "🌅", label: "Petit-déj", defaultHour: 8 },
  { key: "dejeuner", icon: "☀️", label: "Déjeuner", defaultHour: 13 },
  { key: "diner", icon: "🌙", label: "Dîner", defaultHour: 20 },
  { key: "collation", icon: "🍎", label: "Collation", defaultHour: 16 },
];
