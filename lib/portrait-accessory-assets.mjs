const ASSET_ROOT = "./assets/portrait-accessories/";

export const PORTRAIT_ACCESSORY_ASSET_CATEGORIES = [
  { value: "upper", label: "上衣" },
  { value: "bottom", label: "裤装" },
  { value: "skirt", label: "半裙" },
  { value: "dress", label: "连衣裙" },
  { value: "outer", label: "外套" },
  { value: "uniform", label: "制服" },
  { value: "shoes", label: "鞋子" },
  { value: "bag", label: "包袋" },
  { value: "accessory", label: "配饰" },
  { value: "hat", label: "帽子" },
  { value: "cosplay", label: "COS" },
  { value: "commute", label: "通勤" },
  { value: "casual", label: "休闲" },
  { value: "sport", label: "运动" },
  { value: "formal", label: "礼服" },
  { value: "heritage", label: "国风" },
  { value: "swim", label: "泳装" },
  { value: "place", label: "地点" },
];

function asset(id, category, label, extras = {}) {
  return {
    id,
    category,
    label,
    filename: `portrait-accessory-${id}.png`,
    src: `${ASSET_ROOT}${id}.png`,
    ...extras,
  };
}

function colorSet(assetId, entries) {
  return entries.map(([id, label, swatch]) => ({
    id,
    label,
    swatch,
    filename: `portrait-accessory-${assetId}-${id}.png`,
    src: `${ASSET_ROOT}${assetId}-${id}.png`,
  }));
}

export const DEFAULT_PORTRAIT_ACCESSORY_ASSETS = [
  asset("cosplay-shrine-miko", "cosplay", "巫女COS", {
    colors: colorSet("cosplay-shrine-miko", [["red-white", "红白", "linear-gradient(135deg,#f8fafc 0 48%,#b91c1c 48% 72%,#fee2e2 72%)"], ["blue-white", "蓝白", "linear-gradient(135deg,#f8fafc 0 48%,#2563eb 48% 72%,#dbeafe 72%)"], ["black-red", "黑红", "linear-gradient(135deg,#111827 0 50%,#991b1b 50% 78%,#1f2937 78%)"], ["lavender-white", "薰衣草白", "linear-gradient(135deg,#f8fafc 0 48%,#c4b5fd 48% 76%,#ede9fe 76%)"]]),
    prompt: "Create a photorealistic cosplay portrait wearing the supplied shrine miko inspired red and white kimono-style costume, wide sleeves, waist bow, hair ribbon, wooden prayer wand, and paper streamer props.",
  }),
  asset("cosplay-magical-girl", "cosplay", "魔法少女COS", {
    colors: colorSet("cosplay-magical-girl", [["pastel-pink", "淡粉", "#f4b4bd"], ["sky-blue", "天蓝", "#93c5fd"], ["lilac-purple", "丁香紫", "#c4b5fd"], ["mint-green", "薄荷绿", "#86efac"]]),
    prompt: "Create a photorealistic cosplay portrait wearing the supplied magical girl inspired pastel layered dress, bow details, gloves, boots, hair ornaments, star wand, and matching sparkle props.",
  }),
  asset("cosplay-cyber-warrior", "cosplay", "赛博战士COS", {
    colors: colorSet("cosplay-cyber-warrior", [["cobalt-blue", "钴蓝", "#1d4ed8"], ["neon-green", "荧光绿", "#22c55e"], ["crimson-red", "猩红", "#dc2626"], ["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"]]),
    prompt: "Create a photorealistic cosplay portrait wearing the supplied cyber warrior inspired fitted armor jacket, luminous trim, visor headset, utility belt, gloves, and handheld tech props.",
  }),
  asset("cosplay-fantasy-knight", "cosplay", "幻想骑士COS", {
    colors: colorSet("cosplay-fantasy-knight", [["royal-blue", "皇家蓝", "#1e40af"], ["deep-red", "深红", "#991b1b"], ["forest-green", "森林绿", "#166534"], ["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"]]),
    prompt: "Create a photorealistic cosplay portrait wearing the supplied fantasy knight inspired cape, chest armor, bracers, boots, emblem tabard, and lightweight shield and prop sword props.",
  }),
  asset("upper-minimal-tee", "upper", "极简白T", {
    colors: colorSet("upper-minimal-tee", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["heather-gray", "花灰", "#9ca3af"], ["navy-stripe", "海军条纹", "linear-gradient(135deg,#f8fafc 0 28%,#1e3a8a 28% 42%,#f8fafc 42% 70%,#1e3a8a 70% 84%,#f8fafc 84%)"]]),
  }),
  asset("upper-white-shirt", "upper", "白衬衫", {
    colors: colorSet("upper-white-shirt", [["pure-white", "纯白", "#f8fafc"], ["sky-blue", "天蓝", "#93c5fd"], ["cream-stripe", "奶油细条", "linear-gradient(135deg,#f8fafc 0 35%,#f5e6c8 35% 45%,#f8fafc 45% 72%,#f5e6c8 72% 82%,#f8fafc 82%)"], ["pure-black", "纯黑", "#111827"]]),
  }),
  asset("upper-tube-top", "upper", "抹胸上衣", {
    colors: colorSet("upper-tube-top", [["pure-white", "纯白", "#f8fafc"], ["aqua-blue", "纯蓝", "#38bdf8"], ["pure-black", "纯黑", "#111827"], ["ribbed-pink", "粉色罗纹", "linear-gradient(90deg,#fbcfe8,#f9a8d4,#fbcfe8)"]]),
  }),
  asset("upper-knit-shrug", "upper", "针织短外套", {
    colors: colorSet("upper-knit-shrug", [["pure-white", "纯白", "#f8fafc"], ["soft-pink", "纯粉", "#f4b4bd"], ["oatmeal-knit", "燕麦针织", "linear-gradient(135deg,#e8d7bd,#f4ead8,#d8c0a1)"], ["charcoal-melange", "炭灰混纺", "linear-gradient(135deg,#374151,#6b7280,#1f2937)"]]),
  }),
  asset("upper-hoodie", "upper", "连帽卫衣", {
    colors: colorSet("upper-hoodie", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["heather-gray", "花灰", "#9ca3af"], ["pastel-pink", "淡粉", "#f4b4bd"]]),
  }),
  asset("upper-camisole", "upper", "缎面吊带", {
    colors: colorSet("upper-camisole", [["ivory-white", "象牙白", "#fffaf0"], ["pure-black", "纯黑", "#111827"], ["champagne", "香槟", "#e8d2ad"], ["rose-pink", "玫瑰粉", "#e8a5ad"]]),
  }),
  asset("upper-cropped-cardigan", "upper", "短款开衫", {
    colors: colorSet("upper-cropped-cardigan", [["cream-white", "奶油白", "#f8ecd5"], ["pure-black", "纯黑", "#111827"], ["sky-blue", "天蓝", "#93c5fd"], ["lilac-purple", "丁香紫", "#c4b5fd"]]),
  }),
  asset("upper-oversized-sweater", "upper", "宽松毛衣", {
    colors: colorSet("upper-oversized-sweater", [["oatmeal-knit", "燕麦针织", "linear-gradient(135deg,#e8d7bd,#f4ead8,#d8c0a1)"], ["charcoal-melange", "炭灰混纺", "linear-gradient(135deg,#374151,#6b7280,#1f2937)"], ["navy-blue", "海军蓝", "#1e3a8a"], ["burgundy", "酒红", "#7f1d1d"]]),
  }),
  asset("bottom-straight-trousers", "bottom", "直筒长裤", {
    colors: colorSet("bottom-straight-trousers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["charcoal-gray", "炭灰", "#374151"], ["khaki-twill", "卡其斜纹", "linear-gradient(135deg,#c4a484,#e0c7a3,#b8926a)"]]),
  }),
  asset("bottom-blue-jeans", "bottom", "牛仔裤", {
    colors: colorSet("bottom-blue-jeans", [["pure-white", "纯白", "#f8fafc"], ["indigo-blue", "纯蓝", "#1d4ed8"], ["washed-denim", "浅水洗", "linear-gradient(135deg,#bfdbfe,#60a5fa,#93c5fd)"], ["black-denim", "黑灰牛仔", "linear-gradient(135deg,#111827,#4b5563,#1f2937)"]]),
  }),
  asset("bottom-tailored-trousers", "bottom", "西装长裤", {
    colors: colorSet("bottom-tailored-trousers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["navy-blue", "海军蓝", "#1e3a8a"], ["oat-check", "燕麦格纹", "linear-gradient(45deg,#d8c3a5 0 25%,#f3e7d3 25% 50%,#b89f7d 50% 75%,#f3e7d3 75%)"]]),
  }),
  asset("bottom-capri-pants", "bottom", "七分裤", {
    colors: colorSet("bottom-capri-pants", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["khaki", "卡其", "#b99b6b"], ["denim-blue", "牛仔蓝", "#2563eb"]]),
  }),
  asset("bottom-pleated-skirt", "skirt", "百褶半身裙", {
    colors: colorSet("bottom-pleated-skirt", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["navy-plaid", "海军格纹", "linear-gradient(45deg,#111827 0 22%,#1e3a8a 22% 46%,#f8fafc 46% 52%,#111827 52% 76%,#1e3a8a 76%)"], ["gray-plaid", "灰色格纹", "linear-gradient(45deg,#4b5563 0 24%,#9ca3af 24% 48%,#f8fafc 48% 54%,#374151 54% 78%,#9ca3af 78%)"]]),
  }),
  asset("bottom-a-line-skirt", "skirt", "A字半身裙", {
    colors: colorSet("bottom-a-line-skirt", [["ivory-white", "象牙白", "#fffaf0"], ["pure-black", "纯黑", "#111827"], ["beige-khaki", "米卡其", "#d6b985"], ["moss-green", "苔藓绿", "#59643b"]]),
  }),
  asset("bottom-denim-skirt", "skirt", "牛仔半身裙", {
    colors: colorSet("bottom-denim-skirt", [["light-denim", "浅牛仔", "linear-gradient(135deg,#bfdbfe,#60a5fa,#93c5fd)"], ["indigo-denim", "靛蓝牛仔", "linear-gradient(135deg,#1e3a8a,#2563eb,#172554)"], ["black-denim", "黑灰牛仔", "linear-gradient(135deg,#111827,#4b5563,#1f2937)"], ["white-denim", "白色牛仔", "#f8fafc"]]),
  }),
  asset("bottom-wide-leg-shorts", "bottom", "阔腿短裤", {
    colors: colorSet("bottom-wide-leg-shorts", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["khaki-twill", "卡其斜纹", "linear-gradient(135deg,#c4a484,#e0c7a3,#b8926a)"], ["charcoal-gray", "炭灰", "#374151"]]),
  }),
  asset("outer-field-jacket", "outer", "工装夹克", {
    colors: colorSet("outer-field-jacket", [["olive-green", "橄榄绿", "#556b2f"], ["charcoal-gray", "炭灰", "#374151"], ["khaki-twill", "卡其斜纹", "linear-gradient(135deg,#c4a484,#e0c7a3,#b8926a)"], ["navy-blue", "海军蓝", "#1e3a8a"]]),
  }),
  asset("outer-parka", "outer", "连帽派克", {
    colors: colorSet("outer-parka", [["olive-green", "橄榄绿", "#556b2f"], ["pure-black", "纯黑", "#111827"], ["sand-beige", "沙米色", "#d6b985"], ["slate-blue", "石板蓝", "#475569"]]),
  }),
  asset("outer-leather-coat", "outer", "黑色皮大衣", {
    colors: colorSet("outer-leather-coat", [["pure-black", "纯黑", "#111827"], ["chocolate-brown", "巧克力棕", "#5c3a21"], ["cream-white", "奶油白", "#f8ecd5"], ["burgundy", "酒红", "#7f1d1d"]]),
  }),
  asset("dress-vintage-day", "dress", "复古连衣裙", {
    colors: colorSet("dress-vintage-day", [["mustard-yellow", "芥末黄", "#d6a733"], ["pure-black", "纯黑", "#111827"], ["cream-white", "奶油白", "#f8ecd5"], ["dusty-blue", "灰雾蓝", "#7ea3c8"]]),
  }),
  asset("dress-evening", "formal", "礼服裙", {
    colors: colorSet("dress-evening", [["navy-blue", "海军蓝", "#1e3a8a"], ["pure-black", "纯黑", "#111827"], ["champagne", "香槟", "#e8d2ad"], ["deep-red", "深红", "#991b1b"]]),
  }),
  asset("dress-ballet-tutu", "dress", "芭蕾纱裙", {
    colors: colorSet("dress-ballet-tutu", [["blush-pink", "腮红粉", "#f4b4bd"], ["pure-white", "纯白", "#f8fafc"], ["lilac-purple", "丁香紫", "#c4b5fd"], ["sky-blue", "天蓝", "#93c5fd"]]),
  }),
  asset("dress-jk-uniform-set", "uniform", "JK裙装", {
    colors: colorSet("dress-jk-uniform-set", [["navy-plaid", "海军格纹", "linear-gradient(45deg,#111827 0 22%,#1e3a8a 22% 46%,#f8fafc 46% 52%,#111827 52% 76%,#1e3a8a 76%)"], ["red-plaid", "红色格纹", "linear-gradient(45deg,#7f1d1d 0 25%,#dc2626 25% 45%,#111827 45% 56%,#f8fafc 56% 62%,#7f1d1d 62%)"], ["gray-plaid", "灰色格纹", "linear-gradient(45deg,#4b5563 0 24%,#9ca3af 24% 48%,#f8fafc 48% 54%,#374151 54% 78%,#9ca3af 78%)"], ["black-plaid", "黑色格纹", "linear-gradient(45deg,#030712 0 28%,#1f2937 28% 50%,#9ca3af 50% 56%,#030712 56% 82%,#374151 82%)"]]),
  }),
  asset("dress-one-piece-swimsuit", "swim", "连体泳衣", {
    colors: colorSet("dress-one-piece-swimsuit", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["cobalt-blue", "钴蓝", "#1d4ed8"], ["coral-pink", "珊瑚粉", "#fb7185"]]),
  }),
  asset("dress-qipao", "heritage", "旗袍", {
    colors: colorSet("dress-qipao", [["ivory-white", "象牙白", "#fffaf0"], ["pure-black", "纯黑", "#111827"], ["jade-green", "玉绿色", "#8fb7a0"], ["deep-red", "深红", "#991b1b"]]),
  }),
  asset("dress-hanfu-ruqun", "heritage", "古装汉服", {
    colors: colorSet("dress-hanfu-ruqun", [["white-blue", "白蓝", "linear-gradient(135deg,#f8fafc 0 48%,#60a5fa 48% 72%,#dbeafe 72%)"], ["black-red", "黑红", "linear-gradient(135deg,#111827 0 50%,#991b1b 50% 78%,#1f2937 78%)"], ["celadon-green", "青瓷绿", "linear-gradient(135deg,#f0fdf4,#a7c7b4,#e8f5e9)"], ["lavender-purple", "浅紫", "linear-gradient(135deg,#faf5ff,#c4b5fd,#ede9fe)"]]),
  }),
  asset("shoes-white-sneakers", "shoes", "白色运动鞋", {
    colors: colorSet("shoes-white-sneakers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"], ["green-accent", "白绿点缀", "linear-gradient(135deg,#f8fafc 0 58%,#22c55e 58% 72%,#f8fafc 72%)"]]),
  }),
  asset("shoes-skate-sneakers", "shoes", "滑板鞋", {
    colors: colorSet("shoes-skate-sneakers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["brown-white", "棕白拼色", "linear-gradient(135deg,#f8fafc 0 52%,#8b5e34 52%)"], ["navy-blue", "海军蓝", "#1e3a8a"]]),
  }),
  asset("shoes-black-loafers", "shoes", "黑色乐福鞋", {
    colors: colorSet("shoes-black-loafers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["burgundy", "酒红", "#7f1d1d"], ["brown-croc", "棕色压纹", "linear-gradient(135deg,#7c4a25,#b77942,#5f3719)"]]),
  }),
  asset("shoes-high-heels", "shoes", "高跟鞋", {
    colors: colorSet("shoes-high-heels", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["nude-pink", "裸粉", "#f3c7bd"], ["metallic-silver", "金属银", "linear-gradient(135deg,#f8fafc,#9ca3af,#e5e7eb)"]]),
  }),
  asset("bag-doctor", "bag", "复古手提包", {
    colors: colorSet("bag-doctor", [["tan-brown", "焦糖棕", "#b77942"], ["pure-black", "纯黑", "#111827"], ["burgundy", "酒红", "#7f1d1d"], ["cream-white", "奶油白", "#f8ecd5"]]),
  }),
  asset("bag-beauty-case", "bag", "小方箱包", {
    colors: colorSet("bag-beauty-case", [["cream-white", "奶油白", "#f8ecd5"], ["pure-black", "纯黑", "#111827"], ["rose-pink", "玫瑰粉", "#e8a5ad"], ["champagne", "香槟", "#e8d2ad"]]),
  }),
  asset("bag-tote", "bag", "托特包", {
    colors: colorSet("bag-tote", [["natural-canvas", "原色帆布", "#d8c7a3"], ["pure-black", "纯黑", "#111827"], ["denim-blue", "牛仔蓝", "#2563eb"], ["olive-green", "橄榄绿", "#556b2f"]]),
  }),
  asset("accessory-blue-tie", "accessory", "蓝色领带", {
    colors: colorSet("accessory-blue-tie", [["navy-blue", "海军蓝", "#1e3a8a"], ["burgundy", "酒红", "#7f1d1d"], ["charcoal-gray", "炭灰", "#374151"], ["forest-green", "森林绿", "#166534"]]),
  }),
  asset("accessory-bow-tie", "accessory", "黑色领结", {
    colors: colorSet("accessory-bow-tie", [["pure-black", "纯黑", "#111827"], ["ivory-white", "象牙白", "#fffaf0"], ["burgundy", "酒红", "#7f1d1d"], ["navy-blue", "海军蓝", "#1e3a8a"]]),
  }),
  asset("accessory-leather-belt", "accessory", "皮带", {
    colors: colorSet("accessory-leather-belt", [["black-leather", "黑色皮革", "#111827"], ["chocolate-brown", "巧克力棕", "#5c3a21"], ["tan-brown", "焦糖棕", "#b77942"], ["cream-white", "奶油白", "#f8ecd5"]]),
  }),
  asset("accessory-watch", "accessory", "腕表", {
    colors: colorSet("accessory-watch", [["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"], ["gold-tone", "金色", "linear-gradient(135deg,#f8e7a2,#d4af37,#fff4bf)"], ["rose-gold", "玫瑰金", "linear-gradient(135deg,#f9c6b8,#c9887b,#ffe1d8)"], ["black-leather", "黑色皮革", "#111827"]]),
  }),
  asset("accessory-sunglasses", "accessory", "太阳镜", {
    colors: colorSet("accessory-sunglasses", [["pure-black", "纯黑", "#111827"], ["tortoise-brown", "玳瑁棕", "linear-gradient(135deg,#4a2c17,#b77942,#1f130b)"], ["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"], ["champagne", "香槟", "#e8d2ad"]]),
  }),
  asset("hat-summer", "hat", "夏日草帽", {
    colors: colorSet("hat-summer", [["straw-natural", "麦秆原色", "#d8c07a"], ["cream-white", "奶油白", "#f8ecd5"], ["black-ribbon", "黑色缎带", "linear-gradient(135deg,#d8c07a 0 58%,#111827 58% 72%,#d8c07a 72%)"], ["sage-green", "鼠尾草绿", "#8fa58a"]]),
  }),
  asset("hat-baseball-cap", "hat", "棒球帽", {
    colors: colorSet("hat-baseball-cap", [["pure-black", "纯黑", "#111827"], ["pure-white", "纯白", "#f8fafc"], ["navy-blue", "海军蓝", "#1e3a8a"], ["burgundy", "酒红", "#7f1d1d"]]),
  }),
  asset("hat-fashion", "hat", "女帽", {
    colors: colorSet("hat-fashion", [["cream-white", "奶油白", "#f8ecd5"], ["pure-black", "纯黑", "#111827"], ["blush-pink", "腮红粉", "#f4b4bd"], ["camel-brown", "驼色", "#b77942"]]),
  }),
  asset("commute-blazer-set", "commute", "通勤西装套装", {
    colors: colorSet("commute-blazer-set", [["pure-black", "纯黑", "#111827"], ["navy-blue", "海军蓝", "#1e3a8a"], ["cream-white", "奶油白", "#f8ecd5"], ["camel-brown", "驼色", "#b77942"]]),
  }),
  asset("commute-vest-shirt-set", "commute", "衬衫马甲套装", {
    colors: colorSet("commute-vest-shirt-set", [["charcoal-gray", "炭灰", "#374151"], ["coffee-brown", "咖啡棕", "#6f4e37"], ["navy-blue", "海军蓝", "#1e3a8a"], ["ivory-white", "象牙白", "#fffaf0"]]),
  }),
  asset("casual-denim-jacket-set", "casual", "牛仔夹克套装", {
    colors: colorSet("casual-denim-jacket-set", [["light-denim", "浅牛仔", "linear-gradient(135deg,#bfdbfe,#60a5fa,#93c5fd)"], ["indigo-denim", "靛蓝牛仔", "linear-gradient(135deg,#1e3a8a,#2563eb,#172554)"], ["black-denim", "黑灰牛仔", "linear-gradient(135deg,#111827,#4b5563,#1f2937)"], ["ecru-denim", "本白牛仔", "#f3ead7"]]),
  }),
  asset("casual-cargo-streetwear-set", "casual", "工装休闲套装", {
    colors: colorSet("casual-cargo-streetwear-set", [["olive-green", "橄榄绿", "#556b2f"], ["khaki-twill", "卡其斜纹", "linear-gradient(135deg,#c4a484,#e0c7a3,#b8926a)"], ["pure-black", "纯黑", "#111827"], ["stone-gray", "石灰", "#9ca3af"]]),
  }),
  asset("sport-yoga-set", "sport", "瑜伽运动套装", {
    colors: colorSet("sport-yoga-set", [["pure-black", "纯黑", "#111827"], ["sage-green", "鼠尾草绿", "#8fa58a"], ["powder-blue", "雾蓝", "#93c5fd"], ["dusty-rose", "灰玫瑰", "#c98f9a"]]),
  }),
  asset("sport-tennis-set", "sport", "网球运动套装", {
    colors: colorSet("sport-tennis-set", [["pure-white", "纯白", "#f8fafc"], ["navy-blue", "海军蓝", "#1e3a8a"], ["mint-green", "薄荷绿", "#86efac"], ["lilac-purple", "丁香紫", "#c4b5fd"]]),
  }),
  asset("formal-cocktail-dress", "formal", "鸡尾酒礼裙", {
    colors: colorSet("formal-cocktail-dress", [["pure-black", "纯黑", "#111827"], ["deep-red", "深红", "#991b1b"], ["champagne", "香槟", "#e8d2ad"], ["emerald-green", "祖母绿", "#047857"]]),
  }),
  asset("formal-tuxedo-set", "formal", "礼服西装套装", {
    colors: colorSet("formal-tuxedo-set", [["pure-black", "纯黑", "#111827"], ["ivory-white", "象牙白", "#fffaf0"], ["navy-blue", "海军蓝", "#1e3a8a"], ["burgundy", "酒红", "#7f1d1d"]]),
  }),
  asset("heritage-mamian-skirt-set", "heritage", "马面裙套装", {
    colors: colorSet("heritage-mamian-skirt-set", [["red-gold", "红金", "linear-gradient(135deg,#991b1b 0 58%,#d4af37 58% 72%,#7f1d1d 72%)"], ["black-gold", "黑金", "linear-gradient(135deg,#111827 0 58%,#d4af37 58% 72%,#1f2937 72%)"], ["jade-green", "玉绿色", "#8fb7a0"], ["blue-white", "蓝白", "linear-gradient(135deg,#f8fafc 0 48%,#2563eb 48% 72%,#dbeafe 72%)"]]),
  }),
  asset("heritage-tang-jacket-set", "heritage", "唐装外套套装", {
    colors: colorSet("heritage-tang-jacket-set", [["deep-red", "深红", "#991b1b"], ["pure-black", "纯黑", "#111827"], ["jade-green", "玉绿色", "#8fb7a0"], ["ivory-white", "象牙白", "#fffaf0"]]),
  }),
  asset("swim-bikini-set", "swim", "比基尼套装", {
    colors: colorSet("swim-bikini-set", [["pure-black", "纯黑", "#111827"], ["pure-white", "纯白", "#f8fafc"], ["coral-pink", "珊瑚粉", "#fb7185"], ["cobalt-blue", "钴蓝", "#1d4ed8"]]),
  }),
  asset("swim-rashguard-set", "swim", "防晒泳装套装", {
    colors: colorSet("swim-rashguard-set", [["pure-black", "纯黑", "#111827"], ["navy-blue", "海军蓝", "#1e3a8a"], ["teal-blue", "青蓝", "#0f766e"], ["soft-pink", "柔粉", "#f4b4bd"]]),
  }),
  asset("commute-trench-coat-set", "commute", "通勤风衣套装", {
    colors: colorSet("commute-trench-coat-set", [["stone-beige", "石米色", "#d6c3a5"], ["navy-blue", "海军蓝", "#1e3a8a"], ["olive-green", "橄榄绿", "#556b2f"], ["pure-black", "纯黑", "#111827"]]),
  }),
  asset("commute-knit-cardigan-set", "commute", "针织通勤套装", {
    colors: colorSet("commute-knit-cardigan-set", [["oatmeal-knit", "燕麦针织", "linear-gradient(135deg,#e8d7bd,#f4ead8,#d8c0a1)"], ["charcoal-melange", "炭灰混纺", "linear-gradient(135deg,#374151,#6b7280,#1f2937)"], ["camel-brown", "驼色", "#b77942"], ["ivory-white", "象牙白", "#fffaf0"]]),
  }),
  asset("casual-flannel-shirt-set", "casual", "格纹衬衫套装", {
    colors: colorSet("casual-flannel-shirt-set", [["red-plaid", "红格纹", "linear-gradient(45deg,#7f1d1d 0 26%,#f8fafc 26% 34%,#111827 34% 44%,#b91c1c 44% 72%,#f8fafc 72%)"], ["blue-plaid", "蓝格纹", "linear-gradient(45deg,#1e3a8a 0 28%,#f8fafc 28% 36%,#111827 36% 48%,#2563eb 48% 74%,#f8fafc 74%)"], ["green-plaid", "绿格纹", "linear-gradient(45deg,#166534 0 28%,#f8fafc 28% 36%,#111827 36% 48%,#4d7c0f 48% 74%,#f8fafc 74%)"], ["beige-plaid", "米色格纹", "linear-gradient(45deg,#d6b985 0 28%,#f8fafc 28% 36%,#8b5e34 36% 48%,#ead7b7 48% 74%,#f8fafc 74%)"]]),
  }),
  asset("casual-sweatshirt-jogger-set", "casual", "卫衣慢跑套装", {
    colors: colorSet("casual-sweatshirt-jogger-set", [["heather-gray", "花灰", "#9ca3af"], ["pure-black", "纯黑", "#111827"], ["oatmeal-knit", "燕麦针织", "linear-gradient(135deg,#e8d7bd,#f4ead8,#d8c0a1)"], ["sage-green", "鼠尾草绿", "#8fa58a"]]),
  }),
  asset("sport-running-set", "sport", "跑步运动套装", {
    colors: colorSet("sport-running-set", [["pure-black", "纯黑", "#111827"], ["cobalt-blue", "钴蓝", "#1d4ed8"], ["neon-green", "荧光绿", "#22c55e"], ["coral-pink", "珊瑚粉", "#fb7185"]]),
  }),
  asset("sport-boxing-fitness-set", "sport", "拳击训练套装", {
    colors: colorSet("sport-boxing-fitness-set", [["red-black", "红黑", "linear-gradient(135deg,#991b1b 0 52%,#111827 52%)"], ["black-white", "黑白", "linear-gradient(135deg,#111827 0 52%,#f8fafc 52%)"], ["blue-white", "蓝白", "linear-gradient(135deg,#1d4ed8 0 52%,#f8fafc 52%)"], ["gold-black", "金黑", "linear-gradient(135deg,#d4af37 0 52%,#111827 52%)"]]),
  }),
  asset("formal-gown-cape-set", "formal", "披肩礼服裙", {
    colors: colorSet("formal-gown-cape-set", [["emerald-green", "祖母绿", "#047857"], ["midnight-blue", "午夜蓝", "#172554"], ["champagne", "香槟", "#e8d2ad"], ["deep-red", "深红", "#991b1b"]]),
  }),
  asset("formal-evening-suit-set", "formal", "晚宴西装套装", {
    colors: colorSet("formal-evening-suit-set", [["pure-black", "纯黑", "#111827"], ["ivory-white", "象牙白", "#fffaf0"], ["charcoal-gray", "炭灰", "#374151"], ["wine-red", "酒红", "#7f1d1d"]]),
  }),
  asset("heritage-song-style-hanfu", "heritage", "宋制汉服套装", {
    colors: colorSet("heritage-song-style-hanfu", [["white-blue", "白蓝", "linear-gradient(135deg,#f8fafc 0 48%,#60a5fa 48% 72%,#dbeafe 72%)"], ["celadon-green", "青瓷绿", "linear-gradient(135deg,#f0fdf4,#a7c7b4,#e8f5e9)"], ["peach-pink", "桃粉", "#f4b4bd"], ["ink-black", "墨黑", "#111827"]]),
  }),
  asset("heritage-new-chinese-set", "heritage", "新中式套装", {
    colors: colorSet("heritage-new-chinese-set", [["ivory-white", "象牙白", "#fffaf0"], ["pure-black", "纯黑", "#111827"], ["tea-brown", "茶棕", "#8b5e34"], ["jade-green", "玉绿色", "#8fb7a0"]]),
  }),
  asset("swim-coverup-resort-set", "swim", "罩衫度假泳装", {
    colors: colorSet("swim-coverup-resort-set", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["sea-blue", "海蓝", "#0284c7"], ["coral-pink", "珊瑚粉", "#fb7185"]]),
  }),
  asset("swim-boardshort-set", "swim", "冲浪短裤套装", {
    colors: colorSet("swim-boardshort-set", [["navy-blue", "海军蓝", "#1e3a8a"], ["tropical-print", "热带印花", "linear-gradient(135deg,#0f766e 0 32%,#f97316 32% 45%,#fde68a 45% 62%,#0284c7 62%)"], ["pure-black", "纯黑", "#111827"], ["sunset-orange", "日落橙", "#f97316"]]),
  }),
  asset("place-tea-set", "place", "茶席道具", {
    colors: colorSet("place-tea-set", [["celadon-green", "青瓷绿", "linear-gradient(135deg,#dbeee3,#8fb7a0,#f0fdf4)"], ["white-porcelain", "白瓷", "#f8fafc"], ["bamboo-brown", "竹木棕", "#b68a55"], ["black-clay", "黑陶", "#111827"]]),
    prompt: "Use the supplied compact Chinese tea ceremony prop set as a subtle local portrait prop, preserving its teapot, cups, tray, cloth, ceramic texture, scale, and color.",
  }),
  asset("place-paper-umbrella", "place", "纸伞道具", {
    colors: colorSet("place-paper-umbrella", [["ivory-paper", "象牙纸", "#fffaf0"], ["deep-red", "深红", "#991b1b"], ["indigo-blue", "靛蓝", "#1e3a8a"], ["sage-green", "鼠尾草绿", "#8fb7a0"]]),
    prompt: "Use the supplied traditional paper umbrella prop as a refined location portrait accessory, preserving the bamboo handle, paper ribs, silhouette, and selected color.",
  }),
  asset("place-silk-hand-fan", "place", "丝绸折扇", {
    colors: colorSet("place-silk-hand-fan", [["cream-silk", "奶油丝绸", "#f8ecd5"], ["jade-green", "玉绿色", "#8fb7a0"], ["dusty-rose", "灰玫瑰", "#d8a0a8"], ["ink-black", "墨黑", "#111827"]]),
    prompt: "Use the supplied folded silk hand fan as a tasteful local portrait prop, preserving the rib structure, silk texture, color, and hand-held scale.",
  }),
  asset("place-travel-camera-bag", "place", "旅拍相机包", {
    colors: colorSet("place-travel-camera-bag", [["canvas-beige", "帆布米", "#d8c3a5"], ["pure-black", "纯黑", "#111827"], ["denim-blue", "牛仔蓝", "#2563eb"], ["olive-green", "橄榄绿", "#556b2f"]]),
    prompt: "Use the supplied compact travel camera crossbody bag as a modern location portrait prop, preserving the soft fabric structure, strap detail, color, and realistic scale.",
  }),
];

export function getPortraitAccessoryAssetColor(asset, colorId) {
  const colors = Array.isArray(asset?.colors) ? asset.colors : [];
  return colors.find((color) => color.id === colorId) || colors[0] || null;
}

export function getPortraitAccessoryAssetFileDescriptor(asset, colorId) {
  const color = getPortraitAccessoryAssetColor(asset, colorId);
  return {
    ...asset,
    colorId: color?.id || "",
    colorLabel: color?.label || "",
    filename: color?.filename || asset?.filename || "",
    label: color?.label ? `${asset.label} · ${color.label}` : asset?.label || "",
    src: color?.src || asset?.src || "",
  };
}
