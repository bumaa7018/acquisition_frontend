export const externalAccessRoles = [
  {
    code: "professional_org",
    name: "Мэргэжлийн байгууллага",
    description: "Чөлөөлөлтийн хөрөнгийн үнэлгээ хийх байгууллагын хэрэглэгч",
  },
  {
    code: "mika",
    name: "МИКА",
    description: "Үнэлгээ хийх төлөвтэй нэгж талбарын МИКА мэдээлэл хариуцах хэрэглэгч",
  },
  {
    code: "finance_specialist",
    name: "Санхүүгийн мэргэжилтэн",
    description: "Үнэлгээ хийх төлөвтэй нэгж талбарын санхүүгийн хяналт хийх хэрэглэгч",
  },
  {
    code: "senior_specialist",
    name: "Ахлах мэргэжилтэн",
    description: "Чөлөөлөлт болон холбогдох хэрэглэгч, байгууллага оноох хэрэглэгч",
  },
];

export const externalAccessSeedUsers = [
  {
    email: "professional.primary@example.mn",
    password: "Testpass123!",
    first_name: "Үндсэн",
    last_name: "Үнэлгээчин",
    position: "Мэргэжлийн байгууллага",
    role_codes: ["professional_org"],
  },
  {
    email: "professional.independent@example.mn",
    password: "Testpass123!",
    first_name: "Хөндлөнгийн",
    last_name: "Үнэлгээчин",
    position: "Хөндлөнгийн мэргэжлийн байгууллага",
    role_codes: ["professional_org"],
  },
  {
    email: "mika@example.mn",
    password: "Testpass123!",
    first_name: "МИКА",
    last_name: "Мэргэжилтэн",
    position: "МИКА",
    role_codes: ["mika"],
  },
  {
    email: "finance.specialist@example.mn",
    password: "Testpass123!",
    first_name: "Санхүү",
    last_name: "Мэргэжилтэн",
    position: "Санхүүгийн мэргэжилтэн",
    role_codes: ["finance_specialist"],
  },
  {
    email: "senior.specialist@example.mn",
    password: "Testpass123!",
    first_name: "Ахлах",
    last_name: "Мэргэжилтэн",
    position: "Ахлах мэргэжилтэн",
    role_codes: ["senior_specialist"],
  },
];
