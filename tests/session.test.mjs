import { test } from "node:test";
import assert from "node:assert/strict";
process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "test-only";
process.env.VERCEL = "1";

test("sessions survive persistent state reloads and fail safely", async () => {
  const originalFetch = globalThis.fetch;
  const now = new Date().toISOString();
  let stored = { nextUserId: 2, nextCommentId: 1, nextAttachmentId: 1, nextTagId: 1, nextNotifId: 1, reportCounter: 1, patchCounter: 1, users: [{ id: 1, name: "Test", username: "test", password: "test-only-password", role: "Tester", color: "", bg: "", avatar: "", discordWebhook: "", createdAt: now }], reports: [], patches: [], tags: [], notifications: [], kvSettings: {} };
  let unavailable = false;
  let failWrites = false;
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) !== "https://redis.test") throw new Error("Unexpected external request");
    const [method, , value] = JSON.parse(options.body);
    if (unavailable || (method === "SET" && failWrites)) return Response.json({}, { status: 503 });
    if (method === "SET") { writes++; stored = JSON.parse(value); return Response.json({ result: "OK" }); }
    return Response.json({ result: JSON.stringify(stored) });
  };
  try {
    const api = await import("../api/index.ts");
    const req = (path, token, method = "GET", body) => new Request("https://tracker.test/api?apipath=" + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const login = await api.POST(req("login", null, "POST", { username: "test", password: "test-only-password" }));
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.equal(writes, 0);
    for (const route of ["auth/session", "reports", "users", "stats", "metrics", "patches", "tags"]) {
      assert.equal((await api.GET(req(route, token))).status, 200, route);
      assert.equal((await api.GET(req(route, "invalid"))).status, 401, route);
    }
    unavailable = true;
    assert.equal((await api.GET(req("auth/session", token))).status, 503);
    unavailable = false;
    assert.equal((await api.GET(req("auth/session", token))).status, 200);
    failWrites = true;
    assert.equal((await api.POST(req("register", null, "POST", { name: "New", username: "new", password: "test-password" }))).status, 503);
    failWrites = false;
    assert.equal((await api.POST(req("login", null, "POST", { username: "new", password: "test-password" }))).status, 401);
    assert.equal(stored.users.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
