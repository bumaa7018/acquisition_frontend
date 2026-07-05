import test from "node:test";
import assert from "node:assert/strict";
import {
  EVALUATION_STATUS_NAME,
  canAccessAcquisitionForActor,
  canAccessParcelForActor,
  canEditValuationSubTabForActor,
  canViewAcquisitionTabForActor,
  canViewParcelTabForActor,
  canViewValuationSubTabForActor,
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

const primaryProfessional = {
  userId: "professional-primary",
  roles: ["professional_org"],
};
const independentProfessional = {
  userId: "professional-independent",
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

const acquisition = { professional_org_id: "professional-primary" };
const evaluationParcel = {
  status_name: EVALUATION_STATUS_NAME,
  independent_org_id: "professional-independent",
};
const waitingParcel = {
  status_name: "Хүлээгдэж буй",
  independent_org_id: "professional-independent",
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
      { userId: "other-professional", roles: ["professional_org"] },
      acquisition,
      [evaluationParcel],
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
      { userId: "other-professional", roles: ["professional_org"] },
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
