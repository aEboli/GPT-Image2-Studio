import test from "node:test";
import assert from "node:assert/strict";

import { formatHttpErrorMessage } from "../lib/error-formatting.mjs";
import { getFatalUpstreamAbortMessage, isFatalUpstreamError } from "../lib/upstream-fatal-error.mjs";

// The classifier parses text the formatter produced, so both sides are exercised
// together here. Asserting against hand-written strings would let the formatter
// change shape without any test noticing the classifier had stopped matching.
function formatUpstreamError({ status, body }) {
  return formatHttpErrorMessage({ label: "生成请求失败", status, body });
}

function buildErrorBody({ code, message }) {
  return JSON.stringify({ error: { code, message } });
}

test("account-level upstream failures are classified from the formatted message", () => {
  const quotaMessage = formatUpstreamError({
    status: 402,
    body: buildErrorBody({
      code: "insufficient_quota",
      message: "You exceeded your current quota, please check your plan and billing details.",
    }),
  });

  assert.equal(isFatalUpstreamError(quotaMessage), true);

  // 401 is account-level on status alone, whatever the relay calls the code.
  assert.equal(
    isFatalUpstreamError(formatUpstreamError({
      status: 401,
      body: buildErrorBody({ code: "unknown_relay_code", message: "Unauthorized" }),
    })),
    true,
  );

  // A code from the account-level list wins regardless of status: OpenAI itself
  // returns insufficient_quota with 429.
  assert.equal(
    isFatalUpstreamError(formatUpstreamError({
      status: 429,
      body: buildErrorBody({ code: "insufficient_quota", message: "You exceeded your current quota." }),
    })),
    true,
  );

  // No detail at all still classifies on status and code.
  assert.equal(
    isFatalUpstreamError(formatUpstreamError({ status: 402, body: "" })),
    true,
  );

  for (const code of [
    "invalid_api_key",
    "invalid_authentication",
    "account_deactivated",
    "billing_hard_limit_reached",
    "billing_not_active",
    "quota_exceeded",
  ]) {
    assert.equal(
      isFatalUpstreamError(formatUpstreamError({ status: 400, body: buildErrorBody({ code, message: "nope" }) })),
      true,
      `${code} must be account-level`,
    );
  }
});

test("a transient detail vetoes an account-level status and code", () => {
  // The exact text a user reported. The relay overloads both 402 and
  // insufficient_quota to mean "the model pool has no capacity right now", so
  // aborting the batch on it would be a misjudgement: the pool recovers.
  const capacityMessage = formatUpstreamError({
    status: 402,
    body: buildErrorBody({
      code: "insufficient_quota",
      message: "Model capacity is temporarily unavailable.",
    }),
  });

  assert.equal(
    capacityMessage,
    "生成请求失败：HTTP 402，错误码 insufficient_quota，Model capacity is temporarily unavailable.",
  );
  assert.equal(isFatalUpstreamError(capacityMessage), false);

  // Other shapes relays use for the same "come back later" condition, all still
  // carrying an otherwise account-level status or code.
  const vetoed = [
    { status: 402, code: "insufficient_quota", message: "No available channel for this model, please try again." },
    { status: 402, code: "insufficient_quota", message: "Upstream is overloaded, retry later." },
    { status: 401, code: "invalid_api_key", message: "Service temporarily unavailable." },
    { status: 402, code: "quota_exceeded", message: "服务暂时不可用，请稍后重试。" },
    { status: 402, code: "insufficient_quota", message: "当前分组上游负载已饱和，容量不足。" },
    { status: 402, code: "billing_not_active", message: "All channels are busy right now." },
  ];

  for (const { status, code, message } of vetoed) {
    const formatted = formatUpstreamError({ status, body: buildErrorBody({ code, message }) });
    assert.equal(isFatalUpstreamError(formatted), false, `must not abort the batch: ${formatted}`);
  }
});

test("genuine account-level details are not vetoed", () => {
  // These must still abort: no amount of waiting fixes them.
  const stillFatal = [
    { status: 402, code: "insufficient_quota", message: "You exceeded your current quota, please check your plan and billing details." },
    { status: 401, code: "invalid_api_key", message: "Incorrect API key provided." },
    { status: 402, code: "billing_hard_limit_reached", message: "Billing hard limit has been reached." },
    { status: 401, code: "account_deactivated", message: "Your account has been deactivated." },
    { status: 402, code: "insufficient_quota", message: "余额不足，请充值后再试。" },
  ];

  for (const { status, code, message } of stillFatal) {
    const formatted = formatUpstreamError({ status, body: buildErrorBody({ code, message }) });
    assert.equal(isFatalUpstreamError(formatted), true, `must abort the batch: ${formatted}`);
  }
});

test("transient and per-item upstream failures are not classified as account-level", () => {
  // Misjudging these would abort a batch that could still succeed, which is worse
  // than the wasted calls the abort exists to prevent.
  const notFatal = [
    formatUpstreamError({
      status: 429,
      body: buildErrorBody({ code: "rate_limit_exceeded", message: "Rate limit reached." }),
    }),
    formatUpstreamError({ status: 500, body: buildErrorBody({ code: "server_error", message: "oops" }) }),
    formatUpstreamError({ status: 502, body: "<html>bad gateway</html>" }),
    // 403 stays out: relays use it for content policy and region blocks too.
    formatUpstreamError({
      status: 403,
      body: buildErrorBody({ code: "content_policy_violation", message: "Request was rejected." }),
    }),
    "上游响应结束，但没有拿到最终写真图。",
    "流式连接失败，原任务状态未知；系统未自动重新生成。 fetch failed",
    "找不到对应的上传源图。",
  ];

  for (const message of notFatal) {
    assert.equal(isFatalUpstreamError(message), false, `must not be account-level: ${message}`);
  }
});

test("upstream fatal classification never throws on unusable input", () => {
  for (const value of [undefined, null, "", "   ", 0, 402, {}, [], true, new Error("")]) {
    assert.equal(isFatalUpstreamError(value), false);
  }

  // An Error carrying the message is the shape a fan-out worker actually catches.
  assert.equal(
    isFatalUpstreamError(new Error(formatUpstreamError({
      status: 402,
      body: buildErrorBody({ code: "insufficient_quota", message: "no quota" }),
    }))),
    true,
  );
});

test("the abort message keeps the reason and stays account-level itself", () => {
  // Only a genuinely account-level reason ever reaches this function, so the
  // round trip is asserted with one: a vetoed reason never aborts a batch.
  const reason = formatUpstreamError({
    status: 402,
    body: buildErrorBody({
      code: "insufficient_quota",
      message: "You exceeded your current quota, please check your plan and billing details.",
    }),
  });
  const aborted = getFatalUpstreamAbortMessage(reason);

  // The browser decides whether to skip auto-repair from item error text alone,
  // so an aborted item's own error has to re-classify as account-level.
  assert.match(aborted, /已中止本批剩余任务/);
  assert.ok(aborted.includes(reason), "the original upstream reason must survive");
  assert.equal(isFatalUpstreamError(aborted), true);

  // A missing reason still produces a usable, self-consistent message.
  const withoutReason = getFatalUpstreamAbortMessage("");
  assert.match(withoutReason, /已中止本批剩余任务：上游账号级错误。/);
  assert.equal(isFatalUpstreamError(withoutReason), false);
});
