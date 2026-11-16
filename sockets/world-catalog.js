// Everything a player can wear or adopt. The SERVER owns prices and ownership; the client only draws.
// price 0 = everyone has it from the start. Colours are 0xRRGGBB numbers.
const SKINS = [0xf8d9c0, 0xf1c9a5, 0xd9a577, 0xa8714a, 0x7a4a2c, 0x5a3520];
const HAIR_COLORS = [0x1b1410, 0x3b2314, 0x6b4423, 0xc9a24b, 0x2a2a35, 0xb5412e, 0xe8d9b0, 0xff6fb5, 0x5b8def];
const HAIR_STYLES = ["short", "long", "ponytail", "bun", "curly"];
const GENDERS = ["boy", "girl"];

const I = (id, slot, name, price, style, color, extra) => Object.assign({ id, slot, name, price, style, color }, extra || {});

const ITEMS = [
  // ---- tops ----
  I("tee_blue", "top", "Blue tee", 0, "tee", 0x4d7cff),
  I("tee_pink", "top", "Pink tee", 0, "tee", 0xff4d8d),
  I("tee_white", "top", "White tee", 0, "tee", 0xf4f4f4),
  I("tee_green", "top", "Green tee", 0, "tee", 0x43b581),
  I("tank_yellow", "top", "Yellow tank", 15, "tank", 0xffd23f),
  I("hoodie_gray", "top", "Gray hoodie", 40, "hoodie", 0x8d93a1),
  I("hoodie_red", "top", "Red hoodie", 40, "hoodie", 0xd64545),
  I("hoodie_purple", "top", "Purple hoodie", 45, "hoodie", 0x8e5bd6),
  I("sweater_cream", "top", "Cream sweater", 50, "sweater", 0xf2e3c6),
  I("jacket_denim", "top", "Denim jacket", 60, "jacket", 0x4a6fa5),
  I("jacket_leather", "top", "Leather jacket", 90, "jacket", 0x2a2a2e),
  I("dress_floral", "top", "Floral dress", 70, "dress", 0xf48fb1),
  I("dress_sky", "top", "Sky dress", 70, "dress", 0x4fc3f7),
  I("dress_red", "top", "Red dress", 80, "dress", 0xd32f2f),
  // ---- bottoms ----
  I("jeans_blue", "bottom", "Blue jeans", 0, "long", 0x3b5a8c),
  I("shorts_khaki", "bottom", "Khaki shorts", 0, "short", 0xc9b27c),
  I("skirt_pink", "bottom", "Pink skirt", 0, "skirt", 0xf06292),
  I("trousers_black", "bottom", "Black trousers", 25, "long", 0x22262e),
  I("joggers_gray", "bottom", "Gray joggers", 30, "long", 0x6b7280),
  I("shorts_denim", "bottom", "Denim shorts", 25, "short", 0x4f7ab8),
  I("skirt_plaid", "bottom", "Plaid skirt", 35, "skirt", 0xb23a48),
  I("skirt_black", "bottom", "Black skirt", 30, "skirt", 0x25252b),
  // ---- shoes ----
  I("sneakers_white", "shoes", "White sneakers", 0, "sneakers", 0xf5f5f5),
  I("sneakers_black", "shoes", "Black sneakers", 0, "sneakers", 0x222222),
  I("sandals_tan", "shoes", "Sandals", 20, "sandals", 0xc69c6d),
  I("kicks_red", "shoes", "Red kicks", 35, "sneakers", 0xe53935),
  I("boots_brown", "shoes", "Brown boots", 40, "boots", 0x6b4423),
  // ---- hats ----
  I("cap_red", "hat", "Red cap", 20, "cap", 0xe53935),
  I("cap_blue", "hat", "Blue cap", 20, "cap", 0x1e88e5),
  I("beanie_gray", "hat", "Beanie", 20, "beanie", 0x7a808c),
  I("sunhat_straw", "hat", "Sun hat", 25, "sunhat", 0xe3c27a),
  I("bow_pink", "hat", "Hair bow", 15, "bow", 0xff5fa2),
  I("crown_gold", "hat", "Gold crown", 150, "crown", 0xffc400),
  // ---- pets (kind decides the model) ----
  I("dog", "pet", "Puppy", 0, "dog", 0xb07a47),
  I("cat", "pet", "Kitten", 0, "cat", 0xe8944a),
  I("bunny", "pet", "Bunny", 0, "bunny", 0xf4f1ec),
  I("fox", "pet", "Fox", 120, "fox", 0xe2682b),
  I("panda", "pet", "Panda", 150, "panda", 0xf5f5f5),
  I("penguin", "pet", "Penguin", 150, "penguin", 0x23262d)
];

const BY_ID = {};
ITEMS.forEach(i => { BY_ID[i.id] = i; });

const DEFAULT_APPEARANCE = {
  gender: "boy", skin: 1, hair: "short", hairColor: 1,
  top: "tee_blue", bottom: "jeans_blue", shoes: "sneakers_white", hat: null, pet: null
};

// Makes any input safe: unknown or not-owned things fall back to what the player was wearing / a default.
function cleanAppearance(input, owned, fallback) {
  const a = input && typeof input === "object" ? input : {};
  const base = Object.assign({}, DEFAULT_APPEARANCE, fallback || {});
  const have = id => BY_ID[id] && (BY_ID[id].price === 0 || (owned && owned.includes(id)));
  const pick = (slot, v, nullable) => {
    if (v === null && nullable) return null;
    return (typeof v === "string" && BY_ID[v] && BY_ID[v].slot === slot && have(v)) ? v : base[slot];
  };
  const out = {};
  out.gender = GENDERS.includes(a.gender) ? a.gender : base.gender;
  out.skin = Number.isInteger(a.skin) && a.skin >= 0 && a.skin < SKINS.length ? a.skin : base.skin;
  out.hair = HAIR_STYLES.includes(a.hair) ? a.hair : base.hair;
  out.hairColor = Number.isInteger(a.hairColor) && a.hairColor >= 0 && a.hairColor < HAIR_COLORS.length ? a.hairColor : base.hairColor;
  out.top = pick("top", a.top, false);
  out.bottom = pick("bottom", a.bottom, false);
  out.shoes = pick("shoes", a.shoes, false);
  out.hat = pick("hat", a.hat, true);
  out.pet = pick("pet", a.pet, true);
  return out;
}

module.exports = { SKINS, HAIR_COLORS, HAIR_STYLES, GENDERS, ITEMS, BY_ID, DEFAULT_APPEARANCE, cleanAppearance };
