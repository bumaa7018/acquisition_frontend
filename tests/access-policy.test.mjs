import test from "node:test";
import assert from "node:assert/strict";
import {
  EVALUATION_STATUS_NAME,
  canAccessAcquisitionForActor,
  canAccessParcelForActor,
  canCreateDecisionDraftForActor,
  canDeleteDecisionDraftForActor,
  canUpdateDecisionDraftForActor,
  canViewDecisionDraftsForActor,
  canEditValuationSubTabForActor,
  canViewAcquisitionTabForActor,
  canViewParcelTabForActor,
  canViewValuationSubTabForActor,
  actorHasPermission,
  canCreateRole,
  canCreateUser,
  canDeactivateUser,
  canDeleteRole,
  canDeleteUserRow,
  canGrantPermissionForActor,
  canGrantRoleForActor,
  canManageRolePermissions,
  canManageUserRoles,
  canUpdateRole,
  canUpdateUser,
  canViewPermissions,
  canViewSystemSettings,
  canViewHrRegistry,
  canCreateHrRecord,
  canUpdateHrRecord,
  canDeleteHrRecord,
  canViewRolesPage,
  canViewUsersPage,
} from "../src/lib/access-policy.ts";
import { isExternalAuthorization } from "../src/lib/server-auth.ts";
import {
  externalAccessRoles,
  externalAccessSeedUsers,
} from "../scripts/external-access-seed-data.mjs";
import {
  compensationSeedAssets,
  compensationSeedCompensations,
  compensationSeedMarker,
} from "../scripts/compensation-seed-data.mjs";
import {
  assetValuationRows,
  parcelValuations,
  valuationTotals,
} from "../src/lib/valuation-summary.ts";
import {
  calcAreaFromWkt,
  geoJsonToWkt,
  layerTextToWkt,
} from "../src/lib/geometry-utils.ts";

// Мэргэжлийн байгууллагын хандалт нь ХЭРЭГЛЭГЧИЙН биш БАЙГУУЛЛАГЫН
// харьяалалаар (orgId) шийдэгддэг. Тиймээс userId нь org-оос ЗОРИУД өөр —
// хоёрыг андуурсан тохиолдолд эдгээр тест барих ёстой.
const primaryProfessional = {
  userId: "primary-employee-1",
  orgId: "org-primary",
  roles: ["professional_org"],
};
// Нэг байгууллагын ӨӨР ажилтан — ижил эрхтэй байх ёстой.
const primaryProfessionalColleague = {
  userId: "primary-employee-2",
  orgId: "org-primary",
  roles: ["professional_org"],
};
const independentProfessional = {
  userId: "independent-employee-1",
  orgId: "org-independent",
  roles: ["professional_org"],
};
const mika = { userId: "mika-user", roles: ["mika"] };
const finance = {
  userId: "finance-user",
  roles: ["finance_specialist"],
};
const senior = {
  userId: "senior-user",
  roles: ["senior_specialist"],
};
// Захирамжийн төсөлтэй ажиллах мэргэжилтэн — decision:* эрхтэй
const decisionSpecialist = {
  userId: "decision-user",
  roles: ["senior_specialist"],
  permissions: ["land:read", "decision:read", "decision:create", "decision:update"],
};

const acquisition = { professional_org_id: "org-primary" };
const evaluationParcel = {
  status_name: EVALUATION_STATUS_NAME,
  independent_org_id: "org-independent",
};
const waitingParcel = {
  status_name: "Хүлээгдэж буй",
  independent_org_id: "org-independent",
};

test("мэргэжлийн байгууллага зөвхөн өөрт холбогдсон чөлөөлөлтийг харна", () => {
  assert.equal(
    canAccessAcquisitionForActor(primaryProfessional, acquisition),
    true,
  );
  assert.equal(
    canAccessAcquisitionForActor(independentProfessional, acquisition, [
      evaluationParcel,
    ]),
    true,
  );
  assert.equal(
    canAccessAcquisitionForActor(
      { userId: "other-employee", orgId: "org-other", roles: ["professional_org"] },
      acquisition,
      [evaluationParcel],
    ),
    false,
  );
  // Нэг байгууллагын өөр ажилтан ижил эрхтэй — байгууллагад олон ажилтан
  // бүртгэгддэг болсны гол үр дүн.
  assert.equal(
    canAccessAcquisitionForActor(primaryProfessionalColleague, acquisition),
    true,
  );
  // Байгууллагын харьяалалгүй (ажилтны бүртгэлгүй) хэрэглэгч нэвтэрч чадахгүй.
  assert.equal(
    canAccessAcquisitionForActor(
      { userId: "primary-employee-1", roles: ["professional_org"] },
      acquisition,
    ),
    false,
  );
});

test("МИКА, санхүү бүх чөлөөлөлтийг харна", () => {
  assert.equal(canAccessAcquisitionForActor(mika, acquisition), true);
  assert.equal(canAccessAcquisitionForActor(finance, acquisition), true);
});

test("external role-ууд зөвхөн зөвшөөрөгдсөн үнэлгээ хийх төлөвтэй нэгж талбар харна", () => {
  assert.equal(
    canAccessParcelForActor(primaryProfessional, evaluationParcel, acquisition),
    true,
  );
  assert.equal(
    canAccessParcelForActor(
      independentProfessional,
      evaluationParcel,
      acquisition,
    ),
    true,
  );
  assert.equal(
    canAccessParcelForActor(independentProfessional, waitingParcel, acquisition),
    false,
  );
  assert.equal(canAccessParcelForActor(mika, evaluationParcel, acquisition), true);
  assert.equal(
    canAccessParcelForActor(finance, evaluationParcel, acquisition),
    true,
  );
});

test("external role-ууд зөвхөн зөвшөөрөгдсөн tab-уудыг харна", () => {
  assert.equal(canViewAcquisitionTabForActor(mika, "general"), true);
  assert.equal(canViewAcquisitionTabForActor(mika, "parcels"), true);
  assert.equal(canViewAcquisitionTabForActor(mika, "map"), false);
  assert.equal(canViewAcquisitionTabForActor(finance, "financing"), false);
  assert.equal(canViewParcelTabForActor(finance, "general"), true);
  assert.equal(canViewParcelTabForActor(finance, "realEstate"), true);
  assert.equal(canViewParcelTabForActor(finance, "print"), false);
  assert.equal(canViewParcelTabForActor(finance, "holder"), false);
  assert.equal(canViewParcelTabForActor(mika, "holder"), false);
  // Мэргэжлийн байгууллага эзэмшигчийн табыг нэмж харна
  assert.equal(canViewParcelTabForActor(primaryProfessional, "holder"), true);
  assert.equal(canViewParcelTabForActor(primaryProfessional, "documents"), false);
  assert.equal(canViewParcelTabForActor(senior, "print"), true);
  assert.equal(canViewParcelTabForActor(senior, "holder"), true);
  // "Захирамж" таб — зөвхөн decision:read эрхтэй ДОТООД ажилтан харна
  assert.equal(canViewParcelTabForActor(decisionSpecialist, "decree"), true);
  // Эрхгүй дотоод ажилтанд ч харагдахгүй (таб нь decision-drafts API-г дуудна)
  assert.equal(canViewParcelTabForActor(senior, "decree"), false);
  assert.equal(canViewParcelTabForActor(finance, "decree"), false);
  assert.equal(canViewParcelTabForActor(mika, "decree"), false);
  assert.equal(canViewParcelTabForActor(primaryProfessional, "decree"), false);
});

test("захирамжийн төсөл зөвхөн decision:* эрхээр удирдагдана", () => {
  // Захирамжийн төсөлтэй ажиллах мэргэжилтэн
  assert.equal(canViewDecisionDraftsForActor(decisionSpecialist), true);
  assert.equal(canCreateDecisionDraftForActor(decisionSpecialist), true);
  assert.equal(canUpdateDecisionDraftForActor(decisionSpecialist), true);
  // decision:delete олгогдоогүй тул устгахгүй
  assert.equal(canDeleteDecisionDraftForActor(decisionSpecialist), false);

  // land:* эрх нь захирамжийн төсөлд ХҮЧИНГҮЙ (backend ч мөн адил)
  const landOnly = {
    userId: "land-user",
    roles: ["senior_specialist"],
    permissions: ["land:read", "land:create", "land:update", "land:delete"],
  };
  assert.equal(canViewDecisionDraftsForActor(landOnly), false);
  assert.equal(canCreateDecisionDraftForActor(landOnly), false);
  assert.equal(canUpdateDecisionDraftForActor(landOnly), false);
  assert.equal(canDeleteDecisionDraftForActor(landOnly), false);

  // Админ — бүх decision эрхтэй (seed-ээр олгогдоно)
  const admin = {
    userId: "admin-user",
    roles: ["admin"],
    permissions: ["decision:read", "decision:create", "decision:update", "decision:delete"],
  };
  assert.equal(canViewDecisionDraftsForActor(admin), true);
  assert.equal(canDeleteDecisionDraftForActor(admin), true);

  // Гадаад ролиуд — эрх санамсаргүй олгогдсон ч захирамжийн төсөлд хүрэхгүй
  for (const actor of [mika, finance, primaryProfessional]) {
    const withDecision = {
      ...actor,
      permissions: ["decision:read", "decision:create", "decision:update", "decision:delete"],
    };
    assert.equal(canViewDecisionDraftsForActor(withDecision), false, actor.roles[0]);
    assert.equal(canCreateDecisionDraftForActor(withDecision), false, actor.roles[0]);
    assert.equal(canUpdateDecisionDraftForActor(withDecision), false, actor.roles[0]);
    assert.equal(canDeleteDecisionDraftForActor(withDecision), false, actor.roles[0]);
  }

  // Эрхгүй хэрэглэгч
  assert.equal(canViewDecisionDraftsForActor({ userId: "x", roles: [] }), false);
});

test("нөхөх олговорын дэд tab харах эрхүүд зөв байна", () => {
  // "asset" — acquisition ирээгүй үед graceful fallback (үндсэн мэргэжлийн байгуулга)
  assert.equal(canViewValuationSubTabForActor(primaryProfessional, "asset"), true);
  // "asset" — acquisition тулгавал зөвхөн үндсэн мэргэжлийн байгуулга харна
  assert.equal(
    canViewValuationSubTabForActor(primaryProfessional, "asset", null, acquisition),
    true,
  );
  assert.equal(
    canViewValuationSubTabForActor(
      { userId: "other-employee", orgId: "org-other", roles: ["professional_org"] },
      "asset",
      null,
      acquisition,
    ),
    false,
  );
  // "independent" — зөвхөн тухайн парцелийн хөндлөнгийн байгуулга харна
  assert.equal(
    canViewValuationSubTabForActor(
      independentProfessional,
      "independent",
      evaluationParcel,
    ),
    true,
  );
  // "independent" — үндсэн мэргэжлийн байгуулга (хөндлөнгийн биш) харахгүй
  assert.equal(
    canViewValuationSubTabForActor(
      primaryProfessional,
      "independent",
      evaluationParcel,
    ),
    false,
  );
  assert.equal(canViewValuationSubTabForActor(primaryProfessional, "mika"), false);
  assert.equal(canViewValuationSubTabForActor(mika, "mika"), true);
  assert.equal(canViewValuationSubTabForActor(finance, "mika"), true);
});

test("нөхөх олговорын дэд tab засах эрхүүд role, төлөв, холболтоос хамаарна", () => {
  assert.equal(
    canEditValuationSubTabForActor(
      primaryProfessional,
      "asset",
      evaluationParcel,
      acquisition,
    ),
    true,
  );
  assert.equal(
    canEditValuationSubTabForActor(
      independentProfessional,
      "independent",
      evaluationParcel,
      acquisition,
    ),
    true,
  );
  assert.equal(
    canEditValuationSubTabForActor(mika, "mika", evaluationParcel, acquisition),
    true,
  );
  assert.equal(
    canEditValuationSubTabForActor(finance, "mika", evaluationParcel, acquisition),
    false,
  );
  assert.equal(
    canEditValuationSubTabForActor(
      independentProfessional,
      "independent",
      waitingParcel,
      acquisition,
    ),
    false,
  );
});

test("seeder нь шинээр нэмэгдсэн эрх тус бүрийн хэрэглэгчтэй байна", () => {
  const roleCodes = new Set(externalAccessRoles.map((role) => role.code));
  assert.deepEqual(
    [...roleCodes].sort(),
    ["finance_specialist", "mika", "professional_org", "senior_specialist"].sort(),
  );

  for (const roleCode of roleCodes) {
    assert.ok(
      externalAccessSeedUsers.some((user) => user.role_codes.includes(roleCode)),
      `${roleCode} эрхтэй seed хэрэглэгч алга`,
    );
  }

  assert.ok(
    externalAccessSeedUsers.some(
      (user) =>
        user.email === "professional.independent@example.mn" &&
        user.role_codes.includes("professional_org"),
    ),
    "хөндлөнгийн мэргэжлийн байгууллагын seed хэрэглэгч алга",
  );
});

test("report API route external token-ийг 403 болгох боломжтойгоор танина", () => {
  const payload = Buffer.from(
    JSON.stringify({ user_id: "mika-user", roles: ["mika"] }),
  ).toString("base64url");
  const token = `Bearer header.${payload}.signature`;

  assert.equal(isExternalAuthorization(token), true);

  const internalPayload = Buffer.from(
    JSON.stringify({ user_id: "internal-user", roles: ["admin"] }),
  ).toString("base64url");
  assert.equal(
    isExternalAuthorization(`Bearer header.${internalPayload}.signature`),
    false,
  );
});

test("хүний нөөцийн бүртгэл зөвхөн admin роль болон hr эрхтэй үед нээгдэнэ", () => {
  const admin = {
    userId: "admin-user",
    roles: ["admin"],
    permissions: ["hr:read", "hr:create", "hr:update", "hr:delete"],
  };
  assert.equal(canViewHrRegistry(admin), true);
  assert.equal(canCreateHrRecord(admin), true);
  assert.equal(canUpdateHrRecord(admin), true);
  assert.equal(canDeleteHrRecord(admin), true);

  const employee = { userId: "employee-user", roles: ["employee"], permissions: ["hr:read"] };
  assert.equal(canViewHrRegistry(employee), false);
  assert.equal(canCreateHrRecord(employee), false);

  assert.equal(canViewHrRegistry(finance), false);
  assert.equal(canCreateHrRecord(primaryProfessional), false);
});

test("нөхөх төлбөрийн seeder нь үндсэн жишээ төрлүүдийг хамарсан байна", () => {
  assert.ok(compensationSeedAssets.length >= 2);
  assert.ok(
    compensationSeedAssets.some((asset) => asset.asset_type === "real_state"),
    "үл хөдлөх хөрөнгийн жишээ хөрөнгө алга",
  );
  assert.ok(
    compensationSeedAssets.some((asset) => asset.asset_type === "property"),
    "эд хөрөнгийн жишээ хөрөнгө алга",
  );

  assert.ok(
    compensationSeedCompensations.some(
      (compensation) =>
        compensation.target_type === "parcel" &&
        compensation.compensation_type === "cash",
    ),
    "нэгж талбарын мөнгөн нөхөн төлбөрийн жишээ алга",
  );
  assert.ok(
    compensationSeedCompensations.some(
      (compensation) =>
        compensation.target_type === "asset" &&
        compensation.compensation_type === "cash" &&
        compensation.asset_number,
    ),
    "хөрөнгийн мөнгөн нөхөн төлбөрийн жишээ алга",
  );
  assert.ok(
    compensationSeedCompensations.some(
      (compensation) =>
        compensation.compensation_type === "land_grant" &&
        compensation.grant?.parcel_number,
    ),
    "газраар дүйцүүлэх нөхөх олговрын жишээ алга",
  );

  for (const compensation of compensationSeedCompensations) {
    assert.ok(compensation.note.includes(compensationSeedMarker));
    assert.ok(compensation.amount > 0);
    assert.ok(compensation.coverage_percent > 0);
  }
});

test("нөхөх олговорын хүснэгтийн нэгтгэлүүд газар болон хөрөнгөөр зөв бүлэглэгдэнэ", () => {
  const assets = [
    {
      id: "real-1",
      acquisition_id: "acq-1",
      parcel_id: "parcel-1",
      asset_number: "R-1",
      asset_type: "real_state",
      asset_name: "Байшин",
      floor_count: 1,
      area_m2: 60,
      owner_name: "Owner",
      address: "",
      notes: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "prop-1",
      acquisition_id: "acq-1",
      parcel_id: "parcel-1",
      asset_number: "P-1",
      asset_type: "property",
      asset_name: "Хашаа",
      floor_count: 0,
      area_m2: 20,
      owner_name: "Owner",
      address: "",
      notes: "",
      created_at: "",
      updated_at: "",
    },
  ];

  const compensations = [
    {
      id: "land-cash",
      acquisition_id: "acq-1",
      target_type: "parcel",
      parcel_id: "parcel-1",
      compensation_type: "cash",
      coverage_percent: 100,
      amount: 1000,
      created_at: "",
      updated_at: "",
    },
    {
      id: "land-grant",
      acquisition_id: "acq-1",
      target_type: "parcel",
      parcel_id: "parcel-1",
      compensation_type: "land_grant",
      coverage_percent: 70,
      amount: 700,
      created_at: "",
      updated_at: "",
    },
    {
      id: "real-part-1",
      acquisition_id: "acq-1",
      target_type: "asset",
      parcel_id: "parcel-1",
      asset_id: "real-1",
      compensation_type: "cash",
      coverage_percent: 100,
      amount: 5000,
      created_at: "",
      updated_at: "",
    },
    {
      id: "real-part-2",
      acquisition_id: "acq-1",
      target_type: "asset",
      parcel_id: "parcel-1",
      asset_id: "real-1",
      compensation_type: "cash",
      coverage_percent: 100,
      amount: 1500,
      created_at: "",
      updated_at: "",
    },
    {
      id: "prop-part-1",
      acquisition_id: "acq-1",
      target_type: "asset",
      parcel_id: "parcel-1",
      asset_id: "prop-1",
      compensation_type: "cash",
      coverage_percent: 100,
      amount: 800,
      created_at: "",
      updated_at: "",
    },
    {
      id: "other-parcel",
      acquisition_id: "acq-1",
      target_type: "parcel",
      parcel_id: "parcel-2",
      compensation_type: "cash",
      coverage_percent: 100,
      amount: 999,
      created_at: "",
      updated_at: "",
    },
  ];

  assert.equal(parcelValuations(compensations, "parcel-1").length, 2);

  const realRows = assetValuationRows(assets, compensations, "real_state");
  const propertyRows = assetValuationRows(assets, compensations, "property");

  assert.equal(realRows.length, 1);
  assert.equal(realRows[0].total, 6500);
  assert.equal(realRows[0].compensations.length, 2);
  assert.equal(propertyRows.length, 1);
  assert.equal(propertyRows[0].total, 800);

  assert.deepEqual(valuationTotals(assets, compensations, "parcel-1"), {
    landTotal: 1700,
    assetTotal: 7300,
    total: 9000,
  });
});

test("давхардсан хилийн давхаргаас WKT болон талбай тооцоолж чадна", () => {
  const wkt = "POLYGON((1000 1000,1010 1000,1010 1010,1000 1010,1000 1000))";
  assert.equal(calcAreaFromWkt(wkt), 100);

  const geoJson = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
    },
  };

  assert.equal(
    geoJsonToWkt(geoJson),
    "POLYGON((0 0,5 0,5 5,0 5,0 0))",
  );
  assert.equal(layerTextToWkt(JSON.stringify(geoJson)), geoJsonToWkt(geoJson));
});

// ── Хэрэглэгч / роль / эрхийн удирдлагын хандалт ─────────────────────────────

const ALL_ADMIN_PERMS = [
  "users:read",
  "users:create",
  "users:update",
  "users:delete",
  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",
  "permissions:read",
];

const admin = {
  userId: "admin-user",
  roles: ["admin"],
  permissions: [...ALL_ADMIN_PERMS, "admin:read", "audit:read", "land:read"],
};
const readOnlyAdmin = {
  userId: "readonly-user",
  roles: ["employee"],
  permissions: ["users:read", "roles:read", "permissions:read"],
};
const plainEmployee = {
  userId: "employee-user",
  roles: ["employee"],
  permissions: ["land:read"],
};
// Эрх санамсаргүй олгогдсон гадаад хэрэглэгч — цэс нь бүрэн хаалттай байх ёстой.
const externalWithAdminPerms = {
  userId: "external-user",
  roles: ["professional_org"],
  permissions: ALL_ADMIN_PERMS,
};

test("удирдлагын хуудсууд эрхгүй хэрэглэгчид хаалттай", () => {
  assert.equal(canViewUsersPage(admin), true);
  assert.equal(canViewRolesPage(admin), true);
  assert.equal(canViewPermissions(admin), true);
  assert.equal(canViewSystemSettings(admin), true);

  assert.equal(canViewUsersPage(plainEmployee), false);
  assert.equal(canViewRolesPage(plainEmployee), false);
  assert.equal(canViewPermissions(plainEmployee), false);
  assert.equal(canViewSystemSettings(plainEmployee), false);

  // permissions талбар байхгүй actor — шалгалт бүр false
  assert.equal(canViewUsersPage({ userId: "x", roles: ["admin"] }), false);
  assert.equal(actorHasPermission({ userId: "x" }, "users:read"), false);
});

test("гадаад ролиуд эрхтэй байсан ч удирдлагын цэсэд хандахгүй", () => {
  assert.equal(canViewUsersPage(externalWithAdminPerms), false);
  assert.equal(canViewRolesPage(externalWithAdminPerms), false);
  assert.equal(canViewSystemSettings(externalWithAdminPerms), false);
  assert.equal(canCreateUser(externalWithAdminPerms), false);
  assert.equal(canUpdateUser(externalWithAdminPerms), false);
  assert.equal(canDeleteUserRow(externalWithAdminPerms, "someone-else"), false);
  assert.equal(canManageRolePermissions(externalWithAdminPerms), false);
});

test("зөвхөн харах эрхтэй non-admin хэрэглэгч удирдлагын хуудас харахгүй, засах үйлдэл хийхгүй", () => {
  assert.equal(canViewUsersPage(readOnlyAdmin), false);
  assert.equal(canCreateUser(readOnlyAdmin), false);
  assert.equal(canUpdateUser(readOnlyAdmin), false);
  assert.equal(canDeleteUserRow(readOnlyAdmin, "other-user"), false);
  assert.equal(canCreateRole(readOnlyAdmin), false);
  assert.equal(canUpdateRole(readOnlyAdmin), false);
  assert.equal(canDeleteRole(readOnlyAdmin), false);
  assert.equal(canManageRolePermissions(readOnlyAdmin), false);
});

test("өөрийгөө устгах / идэвхгүй болгох / роль өөрчлөх хаалттай", () => {
  // Бусад хэрэглэгч дээр зөвшөөрөгдөнө
  assert.equal(canDeleteUserRow(admin, "other-user"), true);
  assert.equal(canDeactivateUser(admin, "other-user"), true);
  assert.equal(canManageUserRoles(admin, "other-user"), true);

  // Өөрөө дээрээ хориотой (backend user.go-ийн isSelf шалгалттай ижил)
  assert.equal(canDeleteUserRow(admin, admin.userId), false);
  assert.equal(canDeactivateUser(admin, admin.userId), false);
  assert.equal(canManageUserRoles(admin, admin.userId), false);
});

test("эрх нэмэгдүүлэлт: өөрт байхгүй эрхийг олгохгүй", () => {
  assert.equal(canGrantPermissionForActor(admin, "users:delete"), true);
  assert.equal(canGrantPermissionForActor(readOnlyAdmin, "users:delete"), false);

  // Ролийн эрх БҮГД дуудагчид байх ёстой
  assert.equal(canGrantRoleForActor(admin, ["users:read", "users:delete"]), true);
  assert.equal(
    canGrantRoleForActor(readOnlyAdmin, ["users:read", "users:delete"]),
    false,
  );
  // Эрхгүй роль (хоосон багц) — хэн ч олгож болно
  assert.equal(canGrantRoleForActor(readOnlyAdmin, []), true);
  assert.equal(canGrantRoleForActor(readOnlyAdmin, null), true);
  assert.equal(canGrantRoleForActor(readOnlyAdmin, undefined), true);
  // Ганц ч эрх дутвал бүхэлдээ татгалзана
  assert.equal(
    canGrantRoleForActor(readOnlyAdmin, ["users:read", "roles:update"]),
    false,
  );
});

test("10-р системийн admin зөвхөн land/compensation/decision эрхүүдийг тохируулна", () => {
  const system10Admin = {
    userId: "system10-admin",
    roles: ["admin"],
    permissions: ["users:read", "users:create", "roles:read", "permissions:read", "hr:read", "hr:create"],
  };

  assert.equal(canViewSystemSettings(system10Admin), true);
  assert.equal(canManageRolePermissions(system10Admin), true);
  assert.equal(canGrantPermissionForActor(system10Admin, "land:read"), true);
  assert.equal(canGrantPermissionForActor(system10Admin, "compensation:update"), true);
  assert.equal(canGrantPermissionForActor(system10Admin, "decision:create"), true);
  assert.equal(canGrantPermissionForActor(system10Admin, "users:delete"), false);
  assert.equal(
    canGrantRoleForActor(system10Admin, ["land:read", "compensation:update", "decision:create"]),
    true,
  );
  assert.equal(
    canGrantRoleForActor(system10Admin, ["land:read", "users:delete"]),
    false,
  );
});
