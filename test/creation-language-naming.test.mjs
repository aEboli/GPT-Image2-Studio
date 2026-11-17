import assert from "node:assert/strict";
import test from "node:test";
import { getCreationSetLanguageLabel } from "../lib/creation-set-language.mjs";
import { buildCreationRelativeDir } from "../lib/creation-store.mjs";

test("套图从北京时间 2026-11-17 起使用本套保存的中文语言", () => {
  assert.equal(getCreationSetLanguageLabel(null), "");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-16T15:59:59.999Z", targetLanguage: "de" }), "");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-16T16:00:00.000Z", targetLanguage: "de", targetLanguageLabel: "Deutsch" }), "德语");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-17T04:00:00Z", targetLanguage: "pt", targetLanguageLabel: "English" }), "葡萄牙语");
  assert.equal(getCreationSetLanguageLabel({ targetLanguage: "nl" }, "2026-11-17T04:00:00Z"), "荷兰语");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-17T04:00:00Z" }), "英语");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-17T04:00:00Z", targetLanguageLabel: "Français" }), "法语");
  assert.equal(getCreationSetLanguageLabel({ createdAt: "2026-11-17T04:00:00Z", targetLanguage: "custom", targetLanguageLabel: "繁體中文" }), "繁體中文");
});

test("新目录在原名称后追加语言，旧目录规则及唯一标识保持稳定", () => {
  const input = { createdAt: new Date(2026, 10, 17, 12, 41), productName: "电加热触屏手套", setId: "creation-set-12345678" };
  assert.equal(buildCreationRelativeDir({ ...input, targetLanguage: "pt" }), "2026-11/11-17/2026-11-17-creation/1241-电加热触屏手套-12345678-葡萄牙语");
  assert.match(buildCreationRelativeDir({ ...input, targetLanguage: "en", targetLanguageLabel: "English" }), /-12345678-英语$/);
  assert.match(buildCreationRelativeDir({ ...input, targetLanguage: "custom", targetLanguageLabel: "自定义/语言:*?" }), /-自定义语言$/);
  assert.equal(buildCreationRelativeDir({ ...input, createdAt: new Date(2026, 10, 16, 12, 41), targetLanguage: "pt" }), "2026-11/11-16/2026-11-16-creation/1241-电加热触屏手套-12345678");
});
