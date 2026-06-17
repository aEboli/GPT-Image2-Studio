import test from "node:test";
import assert from "node:assert/strict";

import { formatHttpErrorMessage } from "../lib/error-formatting.mjs";

test("formatHttpErrorMessage keeps upstream HTTP errors compact", () => {
  const message = formatHttpErrorMessage({
    label: "图片分析请求失败",
    status: 524,
    body: JSON.stringify({
      type: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/",
      title: "Error",
      status: 524,
      detail:
        "The origin web server did not respond to this request within the 120-second Proxy Read Timeout window.",
      error_code: 524,
      error_name: "origin_response_timeout",
      what_you_should_do:
        "Wait off for at least 120 seconds. If the error persists, the website operator should check long-running processes.",
    }),
  });

  assert.equal(message, "图片分析请求失败：HTTP 524，错误码 524");
  assert.doesNotMatch(message, /developers\\.cloudflare\\.com|origin_response_timeout|Proxy Read Timeout/);
});

test("formatHttpErrorMessage extracts nested provider error codes with compact 4xx detail", () => {
  const message = formatHttpErrorMessage({
    label: "生成请求失败",
    status: 400,
    body: JSON.stringify({
      error: {
        message: `Invalid request details. ${"x".repeat(260)}`,
        code: "invalid_request_error",
      },
    }),
  });

  assert.match(message, /^生成请求失败：HTTP 400，错误码 invalid_request_error，Invalid request details\. x+/);
  assert.match(message, /\.\.\.$/);
  assert.ok(message.length < 280);
});

test("formatHttpErrorMessage keeps OpenAI 400 diagnostic message and param", () => {
  const message = formatHttpErrorMessage({
    label: "生成请求失败",
    status: 400,
    body: JSON.stringify({
      error: {
        message: "Invalid value: '1365x768'. Width and height must be divisible by 16.",
        code: "invalid_value",
        param: "tools[0].size",
      },
    }),
  });

  assert.equal(
    message,
    "生成请求失败：HTTP 400，错误码 invalid_value，Invalid value: '1365x768'. Width and height must be divisible by 16.（参数 tools[0].size）",
  );
});
