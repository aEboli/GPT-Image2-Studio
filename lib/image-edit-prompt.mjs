const ENGLISH_TARGET_PATTERN = /(?:\u82f1\u6587|\u82f1\u8bed|english|latin\s+letters?)/iu;
const NEGATED_ENGLISH_TARGET_PATTERN = /(?:\u4e0d\u8981|\u4e0d\u7528|\u65e0\u9700|\u4e0d\u9700\u8981|without|no|not)\s*(?:\u4f7f\u7528|\u8f93\u51fa|\u6539\u6210|\u7ffb\u8bd1\u4e3a|in|to|for|use)?\s*(?:\u82f1\u6587|\u82f1\u8bed|english|latin\s+letters?)/iu;
const LEGACY_RULE_MARKER = /\s*ENGLISH TEXT RULE:[\s\S]*$/iu;
const CHINESE_TARGET_CLAUSE = /(?:\u8f93\u51fa|\u6539\u6210|\u6539\u4e3a|\u7ffb\u8bd1(?:\u6210|\u4e3a)?|\u4f7f\u7528)\s*(?:\u4e3a|\u6210)?\s*(?:\u82f1\u6587|\u82f1\u8bed|english|latin\s+letters?)/iu;
const ENGLISH_TARGET_CLAUSE = /\b(?:output|rewrite|translate|convert|use)\s+(?:(?:all|the|visible)\s+){0,3}(?:text\s+)?(?:it\s+)?(?:in|into|to|as)?\s*english\b/iu;
const LOGO_NEGATION = /\b(?:not|isn't|is\s+not)\s+(?:a\s+)?logos?\b/giu;
const LOGO_WORD = /\blogos?\b/giu;

const CHINESE_ENGLISH_REWRITE =
  "\u975e\u5546\u54c1/\u5305\u88c5\u6587\u5b57\uff08\u542b\u5de6\u4e0a\u89d2\u548c\u89d2\u843d\u56fe\u5f62\uff09\u5168\u90e8\u91cd\u6784\u4e3a\u82f1\u6587\uff1b\u5546\u54c1/\u5305\u88c5\u8868\u9762\u6587\u5b57\u4fdd\u7559\uff0c\u6a21\u7cca\u6587\u5b57\u5220\u9664";
const ENGLISH_REWRITE =
  "rewrite all non-product/packaging text, including upper-left and corner graphics, in English; keep product/packaging surface text; remove blurry text";

function clean(value) {
  return String(value ?? "").trim();
}

export function buildImageEditPrompt(prompt = "") {
  const source = clean(prompt).replace(LEGACY_RULE_MARKER, "").trim();
  if (!source || !ENGLISH_TARGET_PATTERN.test(source) || NEGATED_ENGLISH_TARGET_PATTERN.test(source)) {
    return source;
  }
  if (source.includes(CHINESE_ENGLISH_REWRITE) || source.includes(ENGLISH_REWRITE)) {
    return source;
  }
  const base = source
    .replace(LOGO_NEGATION, "canvas text")
    .replace(/(?:\u4e0d\u662f|\u4e0d\u5c5e\u4e8e)\s*logos?\b/giu, "\u662f\u753b\u9762\u6587\u5b57")
    .replace(LOGO_WORD, "")
    .replace(/\s+/gu, " ")
    .trim();
  const isChinesePrompt = /[\u3400-\u9FFF]/u.test(base);
  const rewrite = isChinesePrompt ? CHINESE_ENGLISH_REWRITE : ENGLISH_REWRITE;
  const targetClause = isChinesePrompt ? CHINESE_TARGET_CLAUSE : ENGLISH_TARGET_CLAUSE;
  const rewritten = targetClause.test(base)
    ? base.replace(targetClause, rewrite)
    : `${base}; ${rewrite}`;
  return rewritten.replace(/[\uFF0C,;\s]+([\uFF0C,;])/gu, "$1").replace(/[\uFF0C,;\s]+$/u, "").trim();
}
