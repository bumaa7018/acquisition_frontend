import test from "node:test";
import assert from "node:assert/strict";
import { canImportLegacyDataForActor, canSeeAllLegacyImportsForActor } from "../src/lib/access-policy.ts";

const actor = (roles, permissions = []) => ({ userId: 1, orgId: null, valuationOrg: false, roles, permissions });

test("legacy import: admin and senior specialist only", () => {
  assert.equal(canImportLegacyDataForActor(actor(["admin"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["Админ"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["senior_specialist"], ["land:create", "land:update"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["Ахлах мэргэжилтэн"])), true);
  assert.equal(canImportLegacyDataForActor(actor(["employee"], ["land:read"])), false);
  assert.equal(canImportLegacyDataForActor(actor(["department_head"])), false);
  assert.equal(canImportLegacyDataForActor(actor(["professional_org"])), false);
  assert.equal(canImportLegacyDataForActor(actor(["finance_specialist"])), false);
});

test("legacy import: only admin sees every user's imports", () => {
  assert.equal(canSeeAllLegacyImportsForActor(actor(["admin"])), true);
  assert.equal(canSeeAllLegacyImportsForActor(actor(["Админ"])), true);
  assert.equal(canSeeAllLegacyImportsForActor(actor(["senior_specialist"])), false);
});
