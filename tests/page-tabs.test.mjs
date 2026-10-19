// Таб тус бүрийн хугацаа — идэвхтэй таб хэзээ ч хаагдахгүй.

import test from "node:test";
import assert from "node:assert/strict";

const { pruneExpiredTabs, nextTabExpiry, PAGE_TAB_TTL_MS } = await import("../src/lib/page-tabs.ts");

const tab = (key, lastActiveAt) => ({ key, path: key, label: key, lastActiveAt });

test("хугацаа дууссан идэвхгүй таб л хасагдана", () => {
  const now = 1_000_000;
  const tabs = [tab("/map", now - PAGE_TAB_TTL_MS), tab("/parcel", now - PAGE_TAB_TTL_MS + 1), tab("/report", 0)];
  const kept = pruneExpiredTabs(tabs, "/report", now).map((t) => t.key);
  assert.deepEqual(kept, ["/parcel", "/report"], "/report идэвхтэй тул хуучин ч үлдэнэ");
});

test("дараагийн хугацаа — идэвхтэй табыг тооцохгүй", () => {
  const tabs = [tab("/map", 500), tab("/parcel", 100), tab("/report", 300)];
  assert.equal(nextTabExpiry(tabs, "/parcel"), 300 + PAGE_TAB_TTL_MS);
  assert.equal(nextTabExpiry([tab("/map", 1)], "/map"), null);
});
