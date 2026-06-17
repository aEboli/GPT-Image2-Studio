export const PORTRAIT_LOCATION_DATA_SOURCE = {
  label: "2023年统计用区划和城乡划分代码",
  provinceListUrl:
    "https://raw.githubusercontent.com/657258535/China-Area-Region-Administrative-Divisions/main/province.json",
  provinceDetailUrlBase:
    "https://raw.githubusercontent.com/657258535/China-Area-Region-Administrative-Divisions/main/China/",
};

export const PORTRAIT_LOCATION_FALLBACK_PROVINCES = [
  ["11", "北京市"],
  ["12", "天津市"],
  ["13", "河北省"],
  ["14", "山西省"],
  ["15", "内蒙古自治区"],
  ["21", "辽宁省"],
  ["22", "吉林省"],
  ["23", "黑龙江省"],
  ["31", "上海市"],
  ["32", "江苏省"],
  ["33", "浙江省"],
  ["34", "安徽省"],
  ["35", "福建省"],
  ["36", "江西省"],
  ["37", "山东省"],
  ["41", "河南省"],
  ["42", "湖北省"],
  ["43", "湖南省"],
  ["44", "广东省"],
  ["45", "广西壮族自治区"],
  ["46", "海南省"],
  ["50", "重庆市"],
  ["51", "四川省"],
  ["52", "贵州省"],
  ["53", "云南省"],
  ["54", "西藏自治区"],
  ["61", "陕西省"],
  ["62", "甘肃省"],
  ["63", "青海省"],
  ["64", "宁夏回族自治区"],
  ["65", "新疆维吾尔自治区"],
  ["71", "台湾省"],
  ["81", "香港特别行政区"],
  ["82", "澳门特别行政区"],
].map(([code, name]) => ({ code, name }));

const PROVINCE_FEATURES = {
  11: feature("北京城市胡同", ["灰砖胡同", "红墙影调", "院门铜环", "老树影子"], "historic hutong lanes, gray brick walls, red architectural accents, old courtyard doors, and mature tree shadows"),
  12: feature("天津海河街区", ["海河桥影", "近代街屋", "复古路牌", "欧式窗格"], "Haihe riverside streets, concession-era facades, bridge silhouettes, vintage shopfront windows, and restrained retro city props"),
  13: feature("燕赵古城", ["长城青砖", "太行山石", "陶器", "粗麻布"], "Hebei old city texture, Great Wall gray bricks, Taihang stone, pottery, linen cloth, and dry northern light"),
  14: feature("晋商院落", ["砖雕门楼", "红灯笼", "票号木匾", "青石地面"], "Shanxi merchant courtyard details, carved brick gates, red lanterns, wooden plaque shapes without readable text, and blue-stone flooring"),
  15: feature("草原风物", ["草原远景", "毡毯纹理", "马具元素", "风吹草浪"], "Inner Mongolian grassland openness, felt textile texture, subtle saddle-leather prop details, wind-shaped grass, and clear northern sky"),
  21: feature("辽东海港工业感", ["海港栏杆", "红砖厂房", "复古路灯", "冷调海风"], "Liaoning coastal-industrial portrait setting, harbor railings, red-brick factory walls, retro street lamps, and cool sea-air color"),
  22: feature("长白山林雪", ["白桦林", "针叶树", "雪地反光", "木屋纹理"], "Jilin Changbai forest mood, birch trees, conifers, snow reflection, wooden cabin texture, and clean cold light"),
  23: feature("北国冰雪街景", ["冰雪反光", "欧式街廊", "厚围巾道具", "暖窗光"], "Heilongjiang winter street ambience, snow glow, European-influenced arcade facades, warm window light, and cold-air atmosphere"),
  31: feature("上海海派街区", ["梧桐街影", "石库门砖墙", "金属栏杆", "咖啡杯道具"], "Shanghai lane-house texture, plane-tree shadows, shikumen brickwork, metal railings, modern coffee prop, and refined city fashion mood"),
  32: feature("江南水巷", ["青瓦白墙", "石桥", "竹编篮", "水面反光"], "Jiangsu Jiangnan canal town atmosphere, white walls and gray tiles, stone bridge edges, bamboo basket props, and soft water reflections"),
  33: feature("浙江茶山水岸", ["龙井茶席", "竹林", "青瓷器物", "湖面雾气"], "Zhejiang tea field and lake setting, Longjing tea set, bamboo grove, celadon ceramics, misty water light, and elegant green-gray palette"),
  34: feature("徽州粉墙黛瓦", ["马头墙", "宣纸折扇", "竹影", "青石板"], "Anhui Huizhou architecture, horse-head walls, ink-wash paper fan props, bamboo shadows, and slate paving"),
  35: feature("闽南海风骑楼", ["红砖厝", "海风纱帘", "茶具", "骑楼街影"], "Fujian coastal Minnan red-brick homes, arcade street shade, tea props, sea breeze curtains, and warm humid light"),
  36: feature("赣鄱山水", ["瓷器", "青花纹理", "山水雾气", "木窗"], "Jiangxi porcelain and mountain-water setting, blue-white ceramic details, misty hills, wooden windows, and restrained craft texture"),
  37: feature("齐鲁海岸与古城", ["海岸石阶", "啤酒花园感", "鲁派砖墙", "松树影"], "Shandong coastal-old-town mix, stone steps near the sea, pine shadows, brick walls, and a clean maritime city mood"),
  41: feature("中原古都", ["城墙砖", "麦田金色", "唐三彩色感", "石刻纹理"], "Henan central plains mood, ancient city bricks, warm wheat-field color, sancai-inspired ceramic tones, and stone carving texture"),
  42: feature("江城江岸", ["长江江风", "桥梁轮廓", "热干面小碗", "梧桐路面"], "Hubei riverside city portrait setting, Yangtze river breeze, bridge silhouettes, small local food bowl prop, and tree-lined streets"),
  43: feature("湖湘烟火", ["老街石阶", "辣椒红", "竹编器物", "湘江夜色"], "Hunan street-life energy, old stone steps, red pepper color accents, bamboo woven props, and Xiang River evening atmosphere"),
  44: feature("岭南骑楼", ["骑楼廊柱", "醒狮色彩", "荔枝枝叶", "早茶茶盏"], "Guangdong Lingnan arcade columns, subtle lion-dance color accents, lychee leaves, dim-sum tea cups, and humid southern light"),
  45: feature("广西山水与壮锦", ["喀斯特山影", "壮锦纹理", "竹筏元素", "清水倒影"], "Guangxi karst landscape, Zhuang brocade texture, bamboo raft cues, clear-water reflection, and green mountain atmosphere"),
  46: feature("海岛度假", ["椰影", "海浪白沙", "藤编包", "热带花叶"], "Hainan island portrait setting, palm shadows, beach and wave light, woven bag props, tropical leaves, and clean resort sunlight"),
  50: feature("山城街巷", ["坡道台阶", "雾气霓虹", "火锅铜锅", "轻轨桥影"], "Chongqing mountain-city alleys, stair streets, misty neon, hotpot copper prop, rail bridge silhouettes, and layered city depth"),
  51: feature("川西茶馆", ["竹椅茶馆", "盖碗茶", "银杏树影", "青砖墙"], "Sichuan teahouse portrait setting, bamboo chairs, gaiwan tea, ginkgo shadows, gray brick walls, and relaxed warm street life"),
  52: feature("贵州山寨银饰", ["吊脚楼木纹", "苗绣纹样", "银饰光泽", "山雾"], "Guizhou mountain village texture, wooden stilt-house surfaces, Miao embroidery pattern cues, silver accessory glints, and soft mountain mist"),
  53: feature("云南花市古城", ["鲜花篮", "扎染布", "古城石路", "蓝天云影"], "Yunnan old-town and flower-market portrait mood, flower basket props, tie-dye cloth texture, stone-paved streets, and highland blue sky"),
  54: feature("雪域高原", ["经幡色彩", "石墙", "羊毛披肩", "高原天光"], "Tibet plateau atmosphere, prayer-flag color as abstract accents, stone walls, wool shawl texture, and clear high-altitude light"),
  61: feature("长安古韵", ["城墙", "唐风灯笼", "石狮轮廓", "暖色晚光"], "Shaanxi ancient capital atmosphere, city wall bricks, Tang-style lantern shapes, stone lion silhouettes, and warm evening light"),
  62: feature("丝路风沙", ["黄土墙", "敦煌色彩", "驼铃道具", "风沙光影"], "Gansu Silk Road texture, loess walls, Dunhuang-inspired color, small camel-bell prop, and wind-shaped desert light"),
  63: feature("青海湖高原", ["湖蓝远景", "油菜花色", "藏毯纹理", "高原云影"], "Qinghai lake plateau setting, blue lake distance, rapeseed-yellow accents, Tibetan blanket texture, and dramatic cloud shadows"),
  64: feature("塞上葡萄园", ["黄河岸线", "葡萄藤", "砂岩墙", "暖金色"], "Ningxia Yellow River edge, grapevine details, sandstone walls, warm golden light, and dry northwest air"),
  65: feature("西域市集", ["艾德莱斯纹样", "木窗花格", "石榴道具", "日晒土墙"], "Xinjiang bazaar portrait setting, atlas silk pattern cues, carved wooden window lattice, pomegranate prop, sunlit earth walls, and clear desert light"),
  71: feature("台湾街巷", ["骑楼街廊", "机车街景", "凤梨道具", "海风光线"], "Taiwan neighborhood arcade streets, scooter street context, pineapple prop, coastal light, and relaxed humid ambience"),
  81: feature("香港街景", ["霓虹街牌氛围", "天桥栏杆", "叮叮车色感", "密集楼宇"], "Hong Kong dense street portrait setting, neon-sign ambience without readable text, footbridge railings, tram color cues, and layered high-rise depth"),
  82: feature("澳门南欧街巷", ["葡式碎石路", "拱廊", "蓝白瓷砖", "暖色墙面"], "Macau Portuguese-influenced lanes, mosaic stone paving, arcades, blue-white tile texture, and warm wall colors"),
};

const LOCATION_KEYWORD_FEATURES = [
  ["大理|洱海|喜洲|双廊", feature("大理白族风物", ["扎染布", "白族木窗", "洱海风", "鲜花篮"], "Dali Bai culture setting, tie-dye textile, white walls, wood window frames, Erhai lake breeze, and fresh flower basket props")],
  ["丽江|束河", feature("丽江古城", ["纳西木窗", "石板路", "东巴纹样", "暖灯笼"], "Lijiang old-town stone lanes, Naxi wooden window details, Dongba-inspired pattern cues, warm lantern glow, and mountain-town atmosphere")],
  ["杭州|西湖|龙井", feature("杭州西湖茶景", ["龙井茶席", "湖面雾气", "竹影", "丝绸丝巾"], "Hangzhou West Lake and Longjing tea mood, tea set props, lake mist, bamboo shadows, silk scarf texture, and soft green-gray light")],
  ["苏州|姑苏|平江", feature("苏州园林", ["漏窗", "太湖石", "团扇", "白墙黛瓦"], "Suzhou garden setting, lattice windows, Taihu stones, round silk fan prop, white walls and dark tiles, and refined quiet composition")],
  ["成都|锦江|武侯|青羊", feature("成都茶馆街巷", ["盖碗茶", "竹椅", "银杏叶", "川剧色彩"], "Chengdu teahouse-lane setting, gaiwan tea, bamboo chair props, ginkgo leaves, subtle Sichuan opera color accents, and relaxed street life")],
  ["重庆|渝中|洪崖洞|磁器口", feature("重庆山城", ["坡道台阶", "吊脚楼层次", "轻轨桥影", "火锅铜锅"], "Chongqing mountain-city depth, stairs and slopes, layered stilt-house forms, rail bridge silhouettes, and hotpot copper prop")],
  ["广州|荔湾|越秀", feature("广州西关", ["骑楼", "满洲窗", "早茶茶盏", "荔枝枝叶"], "Guangzhou Xiguan arcade setting, colored window glass, morning tea cups, lychee leaves, and humid Lingnan light")],
  ["深圳|南山|福田", feature("深圳都市海岸", ["玻璃天际线", "海滨栏杆", "科技感金属", "棕榈树影"], "Shenzhen modern coastal city setting, glass skyline, seaside railings, polished metal cues, palm shadows, and clean tech-forward light")],
  ["西安|长安|雁塔", feature("西安城墙", ["城墙砖", "唐风灯笼", "石狮", "暖色晚光"], "Xi'an ancient city wall setting, Tang-style lantern shapes, stone lion silhouettes, and warm evening city light")],
  ["拉萨|城关|布达拉", feature("拉萨高原", ["经幡色块", "石墙", "羊毛披肩", "高原蓝天"], "Lhasa plateau setting, prayer-flag color blocks as abstract accents, stone wall texture, wool shawl prop, and clear high-altitude blue sky")],
  ["喀什| Kashgar", feature("喀什古城", ["土墙街巷", "木雕窗", "石榴道具", "艾德莱斯纹样"], "Kashgar old-town earth walls, carved wooden windows, pomegranate prop, atlas silk pattern cues, and golden desert-side light")],
  ["哈尔滨|道里|中央大街", feature("哈尔滨冰雪街廊", ["欧式街廊", "雪地反光", "暖窗光", "厚围巾"], "Harbin Central Street winter mood, European-style arcades, snow reflections, warm window light, and cozy scarf props")],
  ["厦门|鼓浪屿|思明", feature("厦门海岛街巷", ["红砖洋楼", "海风纱帘", "三角梅", "旧钢琴感"], "Xiamen island lane setting, red-brick villas, sea-breeze curtains, bougainvillea, and quiet old-music-room mood")],
  ["青岛|市南|崂山", feature("青岛海岸", ["红瓦绿树", "海岸栏杆", "帆船线条", "冷调海风"], "Qingdao coastal setting, red roofs and green trees, seaside railing, sailboat line cues, and crisp cool sea light")],
  ["三亚|海棠|亚龙湾", feature("三亚热带海滩", ["椰影", "白沙浪花", "藤编包", "热带花叶"], "Sanya tropical beach setting, palm shadows, white sand and wave light, woven bag prop, tropical leaves, and bright resort sun")],
];

function feature(label, objects, scene) {
  return { label, objects, scene };
}

function cleanString(value) {
  return String(value || "").trim();
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const raw = cleanString(value);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRegionNode(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: cleanString(source.name),
    code: cleanString(source.code),
  };
}

function formatPortraitLocationName(source = {}) {
  const seen = new Set();
  const genericNames = new Set(["市辖区", "县"]);
  return ["province", "city", "district", "town"]
    .map((level) => normalizeRegionNode(source[level]))
    .filter((node) => node.name && !genericNames.has(node.name))
    .filter((node) => {
      if (seen.has(node.name)) {
        return false;
      }
      seen.add(node.name);
      return true;
    })
    .map((node) => node.name)
    .join(" · ");
}

function getProvinceCode(source = {}) {
  return normalizeRegionNode(source.province).code.slice(0, 2);
}

export function getPortraitLocationFeatureProfile(selection = {}) {
  const source = parseJsonObject(selection);
  const locationText = [
    source.fullName,
    source.name,
    source.province?.name,
    source.city?.name,
    source.district?.name,
    source.town?.name,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(" ");
  for (const [pattern, profile] of LOCATION_KEYWORD_FEATURES) {
    if (new RegExp(pattern, "i").test(locationText)) {
      return profile;
    }
  }
  return PROVINCE_FEATURES[getProvinceCode(source)] || feature("中国城市在地风物", ["地方手作器物", "街巷肌理", "植物或食物小道具", "本地建筑材质"], "localized Chinese street or travel portrait setting with region-specific materials, craft props, plants or food objects, and believable local light");
}

export function normalizePortraitLocationSelection(value = {}) {
  const source = parseJsonObject(value);
  const normalized = {
    enabled: Boolean(source.enabled),
    province: normalizeRegionNode(source.province),
    city: normalizeRegionNode(source.city),
    district: normalizeRegionNode(source.district),
    town: normalizeRegionNode(source.town),
    sourceLabel: cleanString(source.sourceLabel || PORTRAIT_LOCATION_DATA_SOURCE.label),
  };
  const fullName = cleanString(source.fullName || source.name || formatPortraitLocationName(normalized));
  const profile = getPortraitLocationFeatureProfile({ ...normalized, fullName });
  return {
    ...normalized,
    enabled: normalized.enabled && Boolean(fullName),
    fullName,
    featureTitle: cleanString(source.featureTitle || profile.label),
    featureObjects: Array.isArray(source.featureObjects)
      ? source.featureObjects.map(cleanString).filter(Boolean)
      : profile.objects,
    featureScene: cleanString(source.featureScene || profile.scene),
  };
}

export function buildPortraitLocationPrompt(value = {}) {
  const selection = normalizePortraitLocationSelection(value);
  if (!selection.enabled || !selection.fullName) {
    return "";
  }
  return [
    `Selected location portrait setting: ${selection.fullName}.`,
    `Local feature direction: ${selection.featureTitle}.`,
    `Use believable local objects and visual cues: ${selection.featureObjects.join(", ")}.`,
    `Scene treatment: ${selection.featureScene}.`,
    "LOCATION LOCK: integrate the selected region's architecture, climate, street texture, plants, craft objects, food or travel props as natural supporting context around the subject. Keep the person as the clear portrait subject; avoid map graphics, readable signs, tourism-poster collage, fake logos, extra people, or stereotyped costume unless the user explicitly requests it.",
  ].join(" ");
}
