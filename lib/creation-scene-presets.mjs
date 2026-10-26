const DEFAULT_SCENE_TIMES = Object.freeze([
  "early morning",
  "midday",
  "late afternoon",
  "golden hour",
  "blue hour",
  "warm lamp lit night",
]);

const DEFAULT_SCENE_CAMERAS = Object.freeze([
  "eye level",
  "slightly above",
  "low angle",
  "close and personal",
  "wide and environmental",
]);

const DEFAULT_CREATION_SCENE_PRESET = scenePreset([
  "a clean white countertop",
  "a window-side desktop",
  "a wooden shelf with soft daylight",
  "a neutral seamless backdrop",
  "a light gray studio surface",
  "a minimal side table",
]);

export const CREATION_SCENE_PRESET_BY_PREFIX = Object.freeze({
  C01: scenePreset(
    [
      "a bright entryway bench with a mirror",
      "a sunlit bedroom dresser",
      "a quiet city sidewalk in morning light",
      "a fitting room with a full-length mirror",
      "an open travel suitcase on a bed",
      "a minimalist studio wardrobe rail",
      "a cafe chair with a woven bag",
      "a hotel room luggage rack",
    ],
    ["early morning", "soft midday", "late afternoon", "golden hour", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close-up on fabric and fit", "wide street view"],
  ),
  C02: scenePreset(
    [
      "a marble vanity with a round mirror",
      "a bathroom shelf above a white sink",
      "an open cosmetics bag on a dressing table",
      "a gift-box display on a clean counter",
      "a sunlit bathroom windowsill",
      "a hotel bathroom counter",
      "a soft linen tabletop with flower petals",
    ],
    ["early morning", "soft midday", "late afternoon", "warm lamp lit night"],
    ["eye level", "slightly above", "overhead flat lay", "close-up on texture", "mirror reflection view"],
  ),
  C03: scenePreset(
    [
      "a softly lit nursery with a crib",
      "a baby changing table with folded towels",
      "a family dining table at breakfast",
      "a stroller parked beside a park bench",
      "a calm bedroom rocking chair",
      "a bathroom counter during bath time",
      "a living-room play mat",
    ],
    ["early morning", "soft midday", "late afternoon", "golden hour"],
    ["eye level", "slightly above", "low angle", "close and personal", "wide and environmental"],
  ),
  C04: scenePreset(
    [
      "a clean kitchen counter with a cutting board",
      "a family dining table set for a meal",
      "a picnic blanket on a grassy lawn",
      "a pantry shelf with glass jars",
      "a bright breakfast nook",
      "an open refrigerator shelf",
      "a cafe table by a window",
      "a wooden serving board on a rustic table",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "warm lamp lit night"],
    ["overhead flat lay", "forty-five degree angle", "eye level", "close and personal", "wide table view"],
  ),
  C05: scenePreset(
    [
      "a neatly made bed in a sunlit bedroom",
      "a balcony drying rack in morning light",
      "a linen closet with folded stacks",
      "a window seat with layered cushions",
      "a guest room bed with neutral linens",
      "a bathroom shelf with rolled towels",
      "a sofa layered with soft throws",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "blue hour"],
    ["eye level", "slightly above", "overhead flat lay", "close-up on fabric texture", "wide room view"],
  ),
  C06: scenePreset(
    [
      "a tidy desk beside a window",
      "an open commuter backpack on a cafe table",
      "a bedside table with a charging cable",
      "a cafe table with a laptop and coffee",
      "a minimalist home office",
      "an airplane tray table",
      "a living-room side table",
      "a photography desk with a softbox",
    ],
    ["early morning", "midday", "late afternoon", "blue hour", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close-up on ports and buttons", "wide desk view"],
  ),
  C07: scenePreset(
    [
      "a bright kitchen counter beside a stove",
      "a laundry area with a folding table",
      "a living-room corner with a side table",
      "a pantry or storage-room shelf",
      "a bathroom vanity with a power outlet",
      "a balcony utility corner",
      "a dining-room sideboard",
      "a garage utility bench",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close-up on controls", "wide room view"],
  ),
  C08: scenePreset(
    [
      "a tidy living-room coffee table",
      "a bright entryway console",
      "a bathroom vanity shelf",
      "an organized storage cabinet",
      "a kitchen sink area",
      "a bedroom nightstand",
      "a balcony utility shelf",
    ],
    ["early morning", "midday", "late afternoon", "warm lamp lit night"],
    ["eye level", "slightly above", "close-up on surface detail", "low angle", "wide and environmental"],
  ),
  C09: scenePreset(
    [
      "a sunlit gym floor with rubber mats",
      "a park running path under trees",
      "a rocky mountain trail",
      "a grassy campsite with a tent",
      "a basketball court at dusk",
      "a lakeside wooden dock",
      "a garage home-gym corner",
      "a snowy trailhead",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "blue hour"],
    ["eye level", "low angle", "close and personal", "side angle", "wide and environmental"],
  ),
  C10: scenePreset(
    [
      "a velvet jewelry tray on a vanity",
      "a dressing-table mirror with soft bulbs",
      "an open gift box lined with satin",
      "a wrist display stand on a marble table",
      "a bedside tray with a watch",
      "a boutique display shelf",
      "a silk fabric surface with scattered petals",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "warm lamp lit night"],
    ["overhead macro", "eye-level close-up", "slightly above", "low angle", "wrist-level view"],
  ),
  C11: scenePreset(
    [
      "a living-room rug beside a sofa",
      "a pet bed in a sunny corner",
      "a fenced backyard lawn",
      "a feeding station with a mat",
      "a hallway bench with a leash",
      "a park path beside a bench",
      "a bathroom grooming area",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "warm lamp lit night"],
    ["pet eye level", "slightly above", "low angle", "close and personal", "wide and environmental"],
  ),
  C12: scenePreset(
    [
      "a wooden desk with an open notebook",
      "a bookshelf wall with warm light",
      "an open school backpack on a chair",
      "a library table beside a window",
      "a reading nook armchair",
      "a tidy study desk with a pen cup",
      "a cafe table with a book",
      "a classroom desk",
    ],
    ["early morning", "midday", "late afternoon", "blue hour", "warm lamp lit night"],
    ["eye level", "slightly above", "overhead flat lay", "close-up on pages and materials", "wide room view"],
  ),
  C13: scenePreset(
    [
      "a bright living room with a neutral sofa",
      "a calm bedroom with a low bed",
      "a plant-filled balcony",
      "an entryway with a console and mirror",
      "a dining room with a wooden table",
      "a home-office corner",
      "a sunroom with woven chairs",
      "a compact apartment living area",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "blue hour"],
    ["eye level", "slightly above", "low angle", "close-up on material and joinery", "wide room view"],
  ),
  C14: scenePreset(
    [
      "a practice room with a music stand",
      "a living-room corner beside a piano",
      "a stage edge with a stool",
      "a bedroom with an instrument rack",
      "a studio booth with acoustic panels",
      "a sunlit window seat with a guitar stand",
      "a school music room",
    ],
    ["late morning", "midday", "late afternoon", "blue hour", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close-up on instrument detail", "wide room view"],
  ),
  C15: scenePreset(
    [
      "a bathroom cabinet shelf with folded towels",
      "a bedroom nightstand beside a warm lamp",
      "a clean care station with a small tray",
      "a bathroom sink counter with a mirror",
      "a gym bag open on a bench",
      "a linen-covered side table",
      "a quiet dressing area",
    ],
    ["early morning", "midday", "late afternoon", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close-up on controls and contact surfaces", "wide bathroom view"],
  ),
  C16: scenePreset(
    [
      "an office desk with a monitor",
      "a meeting-room table",
      "a warehouse shelf with labeled bins",
      "a reception counter",
      "a coworking desk",
      "a stockroom packing table",
      "a retail checkout counter",
    ],
    ["early morning", "midday", "late afternoon", "blue hour", "warm lamp lit night"],
    ["eye level", "slightly above", "forty-five degree angle", "close-up on workspace details", "wide office view"],
  ),
  C17: scenePreset(
    [
      "a workshop bench with tools",
      "a warehouse concrete floor",
      "a factory machine station",
      "an inspection table with calipers",
      "a loading dock",
      "a welding bay with safety gear",
      "a clean assembly line",
    ],
    ["early morning", "midday", "late afternoon", "blue hour"],
    ["eye level", "slightly above", "low angle", "close-up on material and mechanism", "wide workshop view"],
  ),
  C18: scenePreset(
    [
      "a garden bed with rich soil",
      "a greenhouse bench with pots",
      "a backyard lawn with a watering can",
      "a tool shed shelf",
      "a vegetable patch edge",
      "a potting table",
      "a sunny orchard row",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "blue hour"],
    ["eye level", "slightly above", "low angle", "close-up on soil and plant detail", "wide garden view"],
  ),
  C19: scenePreset(
    [
      "a clean white countertop",
      "a window-side desktop",
      "a wooden storage shelf",
      "a neutral seamless backdrop",
      "a light gray studio plinth",
      "a minimal side table",
      "a soft fabric surface",
    ],
    ["early morning", "midday", "late afternoon", "golden hour", "blue hour", "warm lamp lit night"],
    ["eye level", "slightly above", "low angle", "close and personal", "wide and environmental"],
  ),
});

function scenePreset(places, times = DEFAULT_SCENE_TIMES, cameras = DEFAULT_SCENE_CAMERAS) {
  return Object.freeze({
    places: Object.freeze([...places]),
    times: Object.freeze([...times]),
    cameras: Object.freeze([...cameras]),
  });
}

function cloneScenePreset(preset) {
  return {
    places: [...preset.places],
    times: [...preset.times],
    cameras: [...preset.cameras],
  };
}

function isScenePreset(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    ["places", "times", "cameras"].every((key) => Array.isArray(value[key]) && value[key].length > 0);
}

export function getCreationScenePresets(categoryValue, fallback = null) {
  const match = /^category:(C\d{2})/.exec(String(categoryValue || "").trim());
  const preset = (match && CREATION_SCENE_PRESET_BY_PREFIX[match[1]]) ||
    (isScenePreset(fallback) ? fallback : DEFAULT_CREATION_SCENE_PRESET);
  return cloneScenePreset(preset);
}
