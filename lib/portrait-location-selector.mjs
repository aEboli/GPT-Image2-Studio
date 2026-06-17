import {
  PORTRAIT_LOCATION_DATA_SOURCE,
  PORTRAIT_LOCATION_FALLBACK_PROVINCES,
  buildPortraitLocationPrompt,
  normalizePortraitLocationSelection,
} from "./portrait-location-presets.mjs";

export { normalizePortraitLocationSelection } from "./portrait-location-presets.mjs";

export function createDefaultPortraitLocationState() {
  return {
    enabled: false,
    loading: false,
    error: "",
    provinces: PORTRAIT_LOCATION_FALLBACK_PROVINCES.map((entry) => ({ ...entry })),
    provinceDetail: null,
    province: null,
    city: null,
    district: null,
    town: null,
  };
}

function cloneLocationNode(node = {}) {
  return {
    name: String(node?.name || "").trim(),
    code: String(node?.code || "").trim(),
  };
}

function pruneLocationNode(node = {}, depth = 0) {
  const pruned = cloneLocationNode(node);
  if (depth < 3) {
    pruned.children = (Array.isArray(node.children) ? node.children : [])
      .map((child) => pruneLocationNode(child, depth + 1))
      .filter((child) => child.name && child.code);
  }
  return pruned;
}

function findLocationOption(options = [], code = "") {
  return options.find((option) => String(option.code) === String(code)) || null;
}

function getLocationChildren(node = null) {
  return Array.isArray(node?.children) ? node.children : [];
}

function syncLocationOptions(documentRef, select, options = [], selectedCode = "", placeholder = "请选择") {
  if (!select) return;
  const previousValue = selectedCode || select.value || "";
  select.replaceChildren();
  const emptyOption = documentRef.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  select.appendChild(emptyOption);
  options.forEach((option) => {
    const item = documentRef.createElement("option");
    item.value = option.code;
    item.textContent = option.name;
    select.appendChild(item);
  });
  select.value = options.some((option) => option.code === previousValue) ? previousValue : "";
}

export function createPortraitLocationSelectorController({
  documentRef = document,
  fetchImpl = fetch,
  refs = {},
  renderPortraitView,
  state,
} = {}) {
  const locationRefs = {
    portraitLocationCityInput: refs.portraitLocationCityInput || documentRef.querySelector("#portraitLocationCityInput"),
    portraitLocationDistrictInput: refs.portraitLocationDistrictInput || documentRef.querySelector("#portraitLocationDistrictInput"),
    portraitLocationEnabledInput: refs.portraitLocationEnabledInput || documentRef.querySelector("#portraitLocationEnabledInput"),
    portraitLocationFeatureText: refs.portraitLocationFeatureText || documentRef.querySelector("#portraitLocationFeatureText"),
    portraitLocationProvinceInput: refs.portraitLocationProvinceInput || documentRef.querySelector("#portraitLocationProvinceInput"),
    portraitLocationSourceText: refs.portraitLocationSourceText || documentRef.querySelector("#portraitLocationSourceText"),
    portraitLocationTownInput: refs.portraitLocationTownInput || documentRef.querySelector("#portraitLocationTownInput"),
  };
  const getLocation = () => state.portrait.location;
  const rerender = () => {
    if (typeof renderPortraitView === "function") {
      renderPortraitView();
    }
  };
  const getCityOptions = () => getLocationChildren(getLocation().provinceDetail);
  const getDistrictOptions = () => getLocationChildren(getLocation().city);
  const getTownOptions = () => getLocationChildren(getLocation().district);

  function buildSelection() {
    const location = getLocation();
    return normalizePortraitLocationSelection({
      enabled: location.enabled,
      province: location.province,
      city: location.city,
      district: location.district,
      town: location.town,
      sourceLabel: PORTRAIT_LOCATION_DATA_SOURCE.label,
    });
  }

  function getPayload() {
    const selection = buildSelection();
    return {
      selection,
      name: selection.enabled ? selection.fullName : "",
      prompt: buildPortraitLocationPrompt(selection),
    };
  }

  function appendFormData(formData) {
    const payload = getPayload();
    formData.set("portraitLocationSelection", JSON.stringify(payload.selection));
    formData.set("portraitLocationPrompt", payload.prompt);
    return payload;
  }

  function getSetFields(plan = {}) {
    const payload = getPayload();
    return {
      locationSelection: plan.locationSelection || payload.selection,
      locationName: plan.locationName || payload.name,
      locationPrompt: plan.locationPrompt || payload.prompt,
    };
  }

  function normalizeSetFields(set = {}) {
    return {
      locationSelection: normalizePortraitLocationSelection(set.locationSelection || {}),
      locationName: String(set.locationName || set.locationSelection?.fullName || ""),
      locationPrompt: String(set.locationPrompt || ""),
    };
  }

  function render() {
    const location = getLocation();
    const enabled = Boolean(location.enabled);
    if (locationRefs.portraitLocationEnabledInput) {
      locationRefs.portraitLocationEnabledInput.checked = enabled;
    }
    syncLocationOptions(documentRef, locationRefs.portraitLocationProvinceInput, location.provinces, location.province?.code, "选择省份");
    syncLocationOptions(documentRef, locationRefs.portraitLocationCityInput, getCityOptions(), location.city?.code, "选择城市");
    syncLocationOptions(documentRef, locationRefs.portraitLocationDistrictInput, getDistrictOptions(), location.district?.code, "选择区县");
    syncLocationOptions(documentRef, locationRefs.portraitLocationTownInput, getTownOptions(), location.town?.code, "选择乡镇");
    [
      locationRefs.portraitLocationProvinceInput,
      locationRefs.portraitLocationCityInput,
      locationRefs.portraitLocationDistrictInput,
      locationRefs.portraitLocationTownInput,
    ].forEach((select) => {
      if (select) select.disabled = !enabled || location.loading;
    });
    const payload = getPayload();
    if (locationRefs.portraitLocationFeatureText) {
      locationRefs.portraitLocationFeatureText.textContent = location.loading
        ? "正在加载地点数据..."
        : location.error || (payload.name ? `${payload.name} · ${payload.selection.featureTitle}` : "开启后选择地点");
    }
    if (locationRefs.portraitLocationSourceText) {
      locationRefs.portraitLocationSourceText.textContent = location.loading ? "加载中" : PORTRAIT_LOCATION_DATA_SOURCE.label;
    }
  }

  async function loadProvinces() {
    const location = getLocation();
    if (location.loading || location.provincesLoaded) {
      return;
    }
    location.loading = true;
    location.error = "";
    render();
    try {
      const response = await fetchImpl(PORTRAIT_LOCATION_DATA_SOURCE.provinceListUrl, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const provinces = (Array.isArray(payload) ? payload : [])
        .map(cloneLocationNode)
        .filter((entry) => entry.name && entry.code);
      if (provinces.length > 0) {
        const fetchedCodes = new Set(provinces.map((entry) => entry.code));
        location.provinces = [
          ...provinces,
          ...PORTRAIT_LOCATION_FALLBACK_PROVINCES
            .filter((entry) => !fetchedCodes.has(entry.code))
            .map((entry) => ({ ...entry })),
        ];
      }
      location.provincesLoaded = true;
    } catch {
      location.error = "地点数据加载失败，可先使用省级特色。";
      location.provinces = PORTRAIT_LOCATION_FALLBACK_PROVINCES.map((entry) => ({ ...entry }));
    } finally {
      location.loading = false;
      render();
    }
  }

  async function loadProvinceDetail(province) {
    const location = getLocation();
    if (!province?.name || location.provinceDetail?.code === province.code) {
      return;
    }
    location.loading = true;
    location.error = "";
    render();
    try {
      const detailUrl = `${PORTRAIT_LOCATION_DATA_SOURCE.provinceDetailUrlBase}${encodeURIComponent(province.name)}.json`;
      const response = await fetchImpl(detailUrl, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      location.provinceDetail = pruneLocationNode(payload, 0);
    } catch {
      location.provinceDetail = { ...province, children: [] };
      location.error = "省内区划加载失败，可先使用省级特色。";
    } finally {
      location.loading = false;
      render();
    }
  }

  async function selectProvince(code = "") {
    const location = getLocation();
    const province = findLocationOption(location.provinces, code);
    location.province = province;
    location.city = null;
    location.district = null;
    location.town = null;
    location.provinceDetail = null;
    render();
    if (province) {
      await loadProvinceDetail(province);
    }
    rerender();
  }

  function selectCity(code = "") {
    const location = getLocation();
    location.city = findLocationOption(getCityOptions(), code);
    location.district = null;
    location.town = null;
    rerender();
  }

  function selectDistrict(code = "") {
    const location = getLocation();
    location.district = findLocationOption(getDistrictOptions(), code);
    location.town = null;
    rerender();
  }

  function selectTown(code = "") {
    getLocation().town = findLocationOption(getTownOptions(), code);
    rerender();
  }

  function setFromSelection(value = {}) {
    const selectedLocation = normalizePortraitLocationSelection(value);
    const location = getLocation();
    location.enabled = selectedLocation.enabled;
    location.province = selectedLocation.province?.code ? selectedLocation.province : null;
    location.city = selectedLocation.city?.code ? selectedLocation.city : null;
    location.district = selectedLocation.district?.code ? selectedLocation.district : null;
    location.town = selectedLocation.town?.code ? selectedLocation.town : null;
    location.provinceDetail = null;
    return selectedLocation;
  }

  function bind() {
    locationRefs.portraitLocationEnabledInput?.addEventListener("change", (event) => {
      getLocation().enabled = Boolean(event.target.checked);
      rerender();
      if (getLocation().enabled) {
        loadProvinces().catch(() => {
          getLocation().error = "地点数据加载失败，可先使用省级特色。";
          rerender();
        });
      }
    });
    locationRefs.portraitLocationProvinceInput?.addEventListener("change", (event) => {
      selectProvince(event.target.value).catch(() => {
        getLocation().error = "省内区划加载失败，可先使用省级特色。";
        rerender();
      });
    });
    locationRefs.portraitLocationCityInput?.addEventListener("change", (event) => selectCity(event.target.value));
    locationRefs.portraitLocationDistrictInput?.addEventListener("change", (event) => selectDistrict(event.target.value));
    locationRefs.portraitLocationTownInput?.addEventListener("change", (event) => selectTown(event.target.value));
  }

  return {
    appendFormData,
    bind,
    getSetFields,
    getPayload,
    loadProvinces,
    normalizeSetFields,
    render,
    setFromSelection,
  };
}
