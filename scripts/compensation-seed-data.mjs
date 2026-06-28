export const compensationSeedMarker = "[seed:compensation]";

export const compensationSeedAssets = [
  {
    asset_number: "SEED-BLD-001",
    asset_type: "real_state",
    asset_name: "Амины орон сууц",
    floor_count: 1,
    area_m2: 64,
    owner_name: "Дамдинсүрэн Болд",
    address: "СХД, 5-р хороо, жишээ хаяг 12",
    notes: `${compensationSeedMarker} Үл хөдлөх хөрөнгийн жишээ өгөгдөл`,
  },
  {
    asset_number: "SEED-PRP-001",
    asset_type: "property",
    asset_name: "Хашаа, худгийн байгууламж",
    floor_count: 0,
    area_m2: 28,
    owner_name: "Дамдинсүрэн Болд",
    address: "СХД, 5-р хороо, жишээ хаяг 12",
    notes: `${compensationSeedMarker} Эд хөрөнгийн жишээ өгөгдөл`,
  },
];

export const compensationSeedCompensations = [
  {
    target_type: "parcel",
    compensation_type: "cash",
    coverage_percent: 100,
    amount: 31_500_000,
    compensation_date: "2026-06-15",
    note: `${compensationSeedMarker} Нэгж талбарын мөнгөн нөхөн төлбөр`,
  },
  {
    target_type: "asset",
    compensation_type: "cash",
    coverage_percent: 100,
    amount: 45_200_000,
    compensation_date: "2026-06-16",
    note: `${compensationSeedMarker} Хөрөнгийн мөнгөн нөхөн төлбөр`,
    asset_number: "SEED-BLD-001",
  },
  {
    target_type: "parcel",
    compensation_type: "land_grant",
    coverage_percent: 70,
    amount: 24_000_000,
    compensation_date: "2026-06-17",
    note: `${compensationSeedMarker} Газраар дүйцүүлэх нөхөх олговор`,
    grant: {
      amount: 24_000_000,
      grant_date: "2026-06-20",
      note: `${compensationSeedMarker} Газрын нөхөх олговрын дэлгэрэнгүй`,
      land_area_m2: 420,
      land_price: 57_143,
      land_location: "СХД, 21-р хороо",
      land_purpose: "Гэр бүлийн хэрэгцээ",
      land_use_type: "Эзэмших",
      parcel_number: "SEED-GRANT-001",
      decree_number: "А/2026-001",
    },
  },
];
