/* Character options, shared by the page (window.LOOK) and the server (require).
   The server uses cleanLook() so nobody can save an option that does not exist. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LOOK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SKINS = [0xf6d3b3, 0xf1c9a5, 0xd9a577, 0xb97c52, 0x8d5a3b, 0x5e3a24];
  const HAIR = [0x1b1410, 0x3b2314, 0x6b4423, 0xc9a24b, 0xb8462f, 0xff6fb5, 0x6c8cff, 0xeeeeee];
  const COLORS = [0xe53935, 0xff7043, 0xfdd835, 0x43a047, 0x00acc1, 0x1e88e5, 0x5e35b1, 0xd81b60, 0xf4f4f4, 0x2b2b33];
  const PET_COLORS = [0x8d5a3b, 0xf4f4f4, 0x2b2b33, 0xd9a577, 0xb8b8c0, 0xf5b942];

  const OPTIONS = {
    gender: ['boy', 'girl'],
    hairStyle: ['short', 'long', 'bun', 'curly'],
    top: ['tee', 'hoodie', 'tank', 'dress'],
    bottom: ['jeans', 'shorts', 'skirt'],
    shoes: ['sneakers', 'boots', 'sandals'],
    hat: ['none', 'cap', 'beanie', 'crown', 'sunhat'],
    pet: ['none', 'dog', 'cat', 'rabbit', 'chick']
  };
  const RANGES = { skin: SKINS.length, hair: HAIR.length, topColor: COLORS.length, bottomColor: COLORS.length, shoeColor: COLORS.length, hatColor: COLORS.length, petColor: PET_COLORS.length };

  const DEFAULT = {
    gender: 'boy', skin: 1, hair: 1, hairStyle: 'short', top: 'tee', topColor: 5, bottom: 'jeans', bottomColor: 9,
    shoes: 'sneakers', shoeColor: 8, hat: 'none', hatColor: 0, pet: 'none', petColor: 0
  };
  const KEYS = Object.keys(DEFAULT);

  // returns a complete, valid look; anything missing or invalid is replaced by a safe value
  function cleanLook(input) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const out = {};
    Object.keys(OPTIONS).forEach(k => { out[k] = typeof src[k] === 'string' && OPTIONS[k].includes(src[k]) ? src[k] : DEFAULT[k]; });
    Object.keys(RANGES).forEach(k => { const v = src[k]; out[k] = Number.isInteger(v) && v >= 0 && v < RANGES[k] ? v : DEFAULT[k]; });
    return out;
  }

  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  // what a person looks like until they choose: varied, but always the same for the same person
  function defaultFor(id, isMe) {
    const h = hash(id), girl = h % 2 === 1;
    return cleanLook({
      gender: girl ? 'girl' : 'boy', skin: h % SKINS.length, hair: (h >> 3) % 6,
      hairStyle: girl ? ['long', 'bun', 'curly'][(h >> 5) % 3] : ['short', 'short', 'curly'][(h >> 5) % 3],
      top: girl && (h >> 7) % 3 === 0 ? 'dress' : ['tee', 'hoodie', 'tank'][(h >> 7) % 3],
      topColor: isMe ? 7 : (h >> 9) % COLORS.length,
      bottom: girl ? ['skirt', 'jeans', 'shorts'][(h >> 11) % 3] : ['jeans', 'shorts', 'jeans'][(h >> 11) % 3],
      bottomColor: [9, 5, 6, 9][(h >> 13) % 4]
    });
  }

  const sig = look => KEYS.map(k => look[k]).join('|');

  return { SKINS, HAIR, COLORS, PET_COLORS, OPTIONS, RANGES, DEFAULT, cleanLook, defaultFor, sig };
});
