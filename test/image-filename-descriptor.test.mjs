import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_NAME_MAX_LENGTH,
  IMAGE_NAME_MIN_LENGTH,
  buildImageFilenameDescriptor,
} from "../lib/image-filename-descriptor.mjs";

test("image name descriptor follows where who do-what order", () => {
  assert.equal(
    buildImageFilenameDescriptor("一位女士在室内演奏大提琴，柔和的侧光，写实摄影"),
    "女士室内大提琴演奏",
  );
  assert.equal(buildImageFilenameDescriptor("女士在海边散步，逆光，电影感"), "女士海边漫步");
  assert.equal(buildImageFilenameDescriptor("一位年轻女性坐在温馨卧室的床上读书"), "女士卧室阅读");
});

test("image name descriptor prefers actions over posture words", () => {
  assert.equal(
    buildImageFilenameDescriptor("一位时尚的年轻男士站在户外黑色路灯旁，双手持握智能手机"),
    "男士户外手机展示",
  );
  assert.equal(buildImageFilenameDescriptor("女士坐在沙发上微笑，柔和光线"), "女士客厅坐姿");
});

test("image name descriptor never pads a name to reach the length target", () => {
  assert.equal(buildImageFilenameDescriptor("女士在花园里，柔和自然光"), "女士花园");
  assert.equal(buildImageFilenameDescriptor("把背景换成海边，保留人物"), "海边");
  assert.equal(buildImageFilenameDescriptor("把衣服换成红色连衣裙"), "连衣裙");
});

test("image name descriptor keeps names inside the length window", () => {
  for (const prompt of [
    "一位时尚的年轻男士站在户外黑色路灯旁，双手持握智能手机，自信地望向一侧",
    "两位女孩在咖啡馆聊天，复古胶片质感",
    "产品图：白色耳机悬浮在浅灰背景上，棚拍柔光",
    "女士在雨后城市街头撑伞行走，霓虹倒影",
    "一位女士站在厨房中。她左手腕上戴着一块简约的方形手表，身穿黑白格纹围裙",
  ]) {
    const name = buildImageFilenameDescriptor(prompt);
    assert.ok(name.length > 0, prompt);
    assert.ok(name.length <= IMAGE_NAME_MAX_LENGTH, `${name} exceeds ${IMAGE_NAME_MAX_LENGTH} characters`);
    assert.ok(IMAGE_NAME_MIN_LENGTH <= 6);
  }
});

test("image name descriptor describes product and picture-type prompts", () => {
  assert.equal(buildImageFilenameDescriptor("生成一张护肤礼盒直播带货主视觉，商业摄影风格"), "礼盒拍摄");
  assert.equal(buildImageFilenameDescriptor("3D 石阶演化信息图，深色背景"), "石阶演化信息图");
  assert.equal(buildImageFilenameDescriptor("中秋节排版海报提示词"), "中秋节排版海报");
});

test("image name descriptor ignores styling detail after the leading clause", () => {
  assert.equal(
    buildImageFilenameDescriptor("一位女士站在厨房中。她左手腕上戴着一块简约的方形手表，身穿黑白格纹围裙"),
    "女士厨房站立",
  );
});

test("image name descriptor refuses prompts it cannot describe", () => {
  assert.equal(buildImageFilenameDescriptor(""), "");
  assert.equal(buildImageFilenameDescriptor("   !!!   "), "");
  assert.equal(buildImageFilenameDescriptor("Premium minimal poster grid overlay"), "");
});

test("image name descriptor skips boilerplate and template placeholders", () => {
  assert.equal(
    buildImageFilenameDescriptor('生成一张海报：{argument name="scene" default="女士在咖啡厅窗边看书"}，柔和自然光'),
    "女士咖啡厅阅读",
  );
});
