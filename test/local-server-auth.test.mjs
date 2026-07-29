import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCAL_SERVER_BASIC_AUTH_USERNAME,
  LOCAL_SERVER_WWW_AUTHENTICATE,
  authorizeLocalServerRequest,
  getLocalServerPlainHttpBindingPolicy,
} from "../lib/local-server-auth.mjs";

const REQUEST_TOKEN = "runtime-test-token";

function authorize(overrides = {}) {
  return authorizeLocalServerRequest({
    method: "GET",
    pathname: "/",
    headers: { host: "studio.example:3600" },
    remoteAddress: "192.168.1.25",
    requestToken: REQUEST_TOKEN,
    explicitHost: "0.0.0.0",
    ...overrides,
  });
}

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("non-loopback requests receive a Basic challenge without valid credentials", () => {
  const result = authorize();

  assert.equal(result.authorized, false);
  assert.equal(result.statusCode, 401);
  assert.equal(result.headers["WWW-Authenticate"], LOCAL_SERVER_WWW_AUTHENTICATE);
});

test("non-loopback requests accept Basic, Bearer, and token-header credentials", () => {
  const basic = authorize({
    headers: {
      host: "studio.example:3600",
      authorization: basicAuthorization(LOCAL_SERVER_BASIC_AUTH_USERNAME, REQUEST_TOKEN),
    },
  });
  const bearer = authorize({
    headers: { host: "studio.example:3600", authorization: `Bearer ${REQUEST_TOKEN}` },
  });
  const header = authorize({
    method: "POST",
    pathname: "/api/config",
    headers: { host: "studio.example:3600", "x-image-studio-token": REQUEST_TOKEN },
  });

  assert.equal(basic.authorized, true);
  assert.equal(bearer.authorized, true);
  assert.equal(header.authorized, true);
});

test("non-loopback requests reject bad credentials and same-origin bypasses", () => {
  const badBasic = authorize({
    headers: {
      host: "studio.example:3600",
      authorization: basicAuthorization(LOCAL_SERVER_BASIC_AUTH_USERNAME, "wrong-token"),
    },
  });
  const wrongUser = authorize({
    headers: {
      host: "studio.example:3600",
      authorization: basicAuthorization("admin", REQUEST_TOKEN),
    },
  });
  const sameOrigin = authorize({
    method: "POST",
    pathname: "/api/config",
    headers: {
      host: "studio.example:3600",
      origin: "http://studio.example:3600",
      "sec-fetch-site": "same-origin",
    },
  });

  for (const result of [badBasic, wrongUser, sameOrigin]) {
    assert.equal(result.authorized, false);
    assert.equal(result.statusCode, 401);
  }
});

test("loopback GET, same-origin browser, CLI, and token behavior stays compatible", () => {
  const loopback = { remoteAddress: "::ffff:127.0.0.1", explicitHost: "" };
  const page = authorize({
    ...loopback,
    headers: { host: "127.0.0.1:3600" },
  });
  const sameOriginPost = authorize({
    ...loopback,
    method: "POST",
    pathname: "/api/config",
    headers: { host: "127.0.0.1:3600", origin: "http://127.0.0.1:3600" },
  });
  const cliPost = authorize({
    ...loopback,
    method: "POST",
    pathname: "/api/config",
    headers: { host: "localhost:3600" },
  });
  const crossOriginPost = authorize({
    ...loopback,
    method: "POST",
    pathname: "/api/config",
    headers: { host: "127.0.0.1:3600", origin: "http://evil.example" },
  });

  assert.equal(page.authorized, true);
  assert.equal(sameOriginPost.authorized, true);
  assert.equal(cliPost.authorized, true);
  assert.equal(crossOriginPost.authorized, false);
  assert.equal(crossOriginPost.statusCode, 403);
});

test("loopback sockets reject DNS-rebound hosts before read or write shortcuts", () => {
  const reboundHeaders = {
    host: "attacker.example:3600",
    origin: "http://attacker.example:3600",
    "sec-fetch-site": "same-origin",
  };
  const attempts = [
    authorize({
      method: "GET",
      pathname: "/api/config",
      headers: reboundHeaders,
      remoteAddress: "127.0.0.1",
      explicitHost: "",
    }),
    authorize({
      method: "GET",
      pathname: "/output/private.png",
      headers: reboundHeaders,
      remoteAddress: "127.0.0.1",
      explicitHost: "",
    }),
    authorize({
      method: "POST",
      pathname: "/api/output/delete",
      headers: reboundHeaders,
      remoteAddress: "127.0.0.1",
      explicitHost: "0.0.0.0",
    }),
    authorize({
      method: "GET",
      pathname: "/",
      headers: {},
      remoteAddress: "127.0.0.1",
      explicitHost: "",
    }),
  ];

  for (const result of attempts) {
    assert.equal(result.authorized, false);
    assert.equal(result.statusCode, 403);
  }

  const tokenAuthorized = authorize({
    method: "POST",
    pathname: "/api/output/delete",
    headers: { ...reboundHeaders, authorization: `Bearer ${REQUEST_TOKEN}` },
    remoteAddress: "127.0.0.1",
    explicitHost: "0.0.0.0",
  });
  assert.equal(tokenAuthorized.authorized, true);
});

test("loopback sockets reject malformed Host values that URL parsing could reinterpret", () => {
  for (const host of [
    "evil.example@127.0.0.1:3600",
    "127.0.0.1#@evil.example:3600",
    "127.0.0.1/path",
    "127.0.0.1?host=evil.example",
  ]) {
    const result = authorize({
      headers: { host },
      remoteAddress: "127.0.0.1",
      explicitHost: "",
    });
    assert.equal(result.authorized, false, host);
    assert.equal(result.statusCode, 403, host);
  }

  const tokenAuthorized = authorize({
    headers: {
      host: "evil.example@127.0.0.1:3600",
      authorization: `Bearer ${REQUEST_TOKEN}`,
    },
    remoteAddress: "127.0.0.1",
    explicitHost: "",
  });
  assert.equal(tokenAuthorized.authorized, true);
});

test("plain HTTP remote binding requires explicit insecure opt-in", () => {
  assert.deepEqual(
    getLocalServerPlainHttpBindingPolicy({ host: "127.0.0.1" }),
    { allowed: true, remote: false, insecure: false },
  );
  assert.deepEqual(
    getLocalServerPlainHttpBindingPolicy({ host: "0.0.0.0" }),
    { allowed: false, remote: true, insecure: false },
  );
  assert.deepEqual(
    getLocalServerPlainHttpBindingPolicy({ host: "0.0.0.0", allowInsecureRemoteHttp: "1" }),
    { allowed: true, remote: true, insecure: true },
  );
});
