import test from "node:test";
import assert from "node:assert/strict";
import { canImportLegacyDataForActor } from "../src/lib/access-policy.ts";

const actor = (roles, permissions = []) => ({ userId: 1, orgId: null, valuationOrg: false, roles, permissions });

test("legacy import is admin-only", () => {
  assert.equal(canImportLegacyDataForActor(actor(["admin"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["Админ"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["senior_specialist"], ["land:create", "land:update"])), false);
  assert.equal(canImportLegacyDataForActor(actor(["professional_org"])), false);
});
