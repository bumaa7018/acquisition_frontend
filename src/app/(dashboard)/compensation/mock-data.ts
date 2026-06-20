export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'

export interface InvoiceItem {
  id: string
  description: string
  unit: string
  qty: number
  unitPrice: number
}

export interface Invoice {
  id: string
  number: string
  parcelId: string
  client: {
    name: string
    address: string
    phone: string
    register: string
  }
  date: string
  due: string
  status: InvoiceStatus
  items: InvoiceItem[]
  notes?: string
}

export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  paid:      { label: 'Төлөгдсөн',        color: '#0acf97', bg: '#0acf971a' },
  pending:   { label: 'Хүлээгдэж буй',    color: '#f9bc0b', bg: '#f9bc0b1a' },
  overdue:   { label: 'Хугацаа хэтэрсэн', color: '#f1556c', bg: '#f1556c1a' },
  cancelled: { label: 'Цуцлагдсан',       color: '#94a3b8', bg: '#94a3b81a' },
}

export function invoiceTotal(inv: Invoice) {
  return inv.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat('mn-MN').format(n) + '₮'
}

export const ISSUER = {
  name: 'СХД 5-р хорооны Засаг даргын Тамгын газар',
  address: 'Энхтайваны өргөн чөлөө 11, СХД, Улаанбаатар 13380',
  phone: '(+976) 11-319-451',
  email: 'info@skhd-5khoroo.ub.gov.mn',
  register: '7019001234',
}

export const INVOICES: Invoice[] = [
  {
    id: '1',
    number: 'НЭХ-2024-001',
    parcelId: 'ГН-2456',
    client: {
      name: 'Дамдинсүрэн Болд',
      address: 'СХД, 5-р хороо, 123-р байр, 14-р тоот',
      phone: '9911-2233',
      register: 'БА96041201',
    },
    date: '2024-01-15',
    due: '2024-02-15',
    status: 'paid',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2456)', unit: 'м²', qty: 250, unitPrice: 120_000 },
      { id: '2', description: 'Барилга байгууламжийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 15_000_000 },
    ],
    notes: 'Нөхөн олговрын гэрээ №2024/01/15-001 дагуу. Төлбөр нь Монгол банк дахь 5002345678 тоот дансанд.',
  },
  {
    id: '2',
    number: 'НЭХ-2024-002',
    parcelId: 'ГН-2457',
    client: {
      name: 'Ганбаатар Мөнхбат',
      address: 'СХД, 5-р хороо, 45-р байр, 3-р тоот',
      phone: '9922-3344',
      register: 'УБ88052305',
    },
    date: '2024-01-20',
    due: '2024-02-20',
    status: 'pending',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2457)', unit: 'м²', qty: 320, unitPrice: 130_000 },
      { id: '2', description: 'Гэрийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 20_900_000 },
    ],
    notes: 'Хөрөнгийн үнэлгээний дүгнэлт №УЗ-2024-0045',
  },
  {
    id: '3',
    number: 'НЭХ-2024-003',
    parcelId: 'ГН-2458',
    client: {
      name: 'Батхүү Энхтайван',
      address: 'СХД, 5-р хороо, 78-р байр, 7-р тоот',
      phone: '9933-4455',
      register: 'ДА92110812',
    },
    date: '2024-01-25',
    due: '2024-02-25',
    status: 'overdue',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2458)', unit: 'м²', qty: 200, unitPrice: 115_000 },
      { id: '2', description: 'Барилга байгууламжийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 15_750_000 },
    ],
  },
  {
    id: '4',
    number: 'НЭХ-2024-004',
    parcelId: 'ГН-2459',
    client: {
      name: 'Отгонбаяр Дэлгэрмаа',
      address: 'СХД, 5-р хороо, 201-р байр, 22-р тоот',
      phone: '9944-5566',
      register: 'ЭА94071534',
    },
    date: '2024-02-01',
    due: '2024-03-01',
    status: 'paid',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2459)', unit: 'м²', qty: 290, unitPrice: 125_000 },
      { id: '2', description: 'Гэрийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 18_750_000 },
    ],
    notes: 'Нөхөн олговрын гэрээ №2024/02/01-004 дагуу',
  },
  {
    id: '5',
    number: 'НЭХ-2024-005',
    parcelId: 'ГН-2460',
    client: {
      name: 'Тэмүүжин Наранцэцэг',
      address: 'СХД, 5-р хороо, 156-р байр, 11-р тоот',
      phone: '9955-6677',
      register: 'ОА87091223',
    },
    date: '2024-02-05',
    due: '2024-03-05',
    status: 'pending',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2460)', unit: 'м²', qty: 380, unitPrice: 135_000 },
      { id: '2', description: 'Барилга байгууламжийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 19_950_000 },
      { id: '3', description: 'Нүүлгэн шилжүүлэлтийн зардал', unit: 'тоо', qty: 1, unitPrice: 2_000_000 },
    ],
    notes: 'Хөрөнгийн үнэлгээний дүгнэлт №УЗ-2024-0089',
  },
  {
    id: '6',
    number: 'НЭХ-2024-006',
    parcelId: 'ГН-2461',
    client: {
      name: 'Хасбаатар Батсүх',
      address: 'СХД, 5-р хороо, 89-р байр, 5-р тоот',
      phone: '9966-7788',
      register: 'ЦА95040345',
    },
    date: '2024-02-10',
    due: '2024-03-10',
    status: 'paid',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2461)', unit: 'м²', qty: 180, unitPrice: 110_000 },
      { id: '2', description: 'Гэрийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 9_200_000 },
    ],
    notes: 'Нөхөн олговрын гэрээ №2024/02/10-006 дагуу',
  },
  {
    id: '7',
    number: 'НЭХ-2024-007',
    parcelId: 'ГН-2462',
    client: {
      name: 'Цэрэнбат Оюун',
      address: 'СХД, 5-р хороо, 234-р байр, 18-р тоот',
      phone: '9977-8899',
      register: 'ДА90020156',
    },
    date: '2024-02-15',
    due: '2024-03-15',
    status: 'overdue',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2462)', unit: 'м²', qty: 450, unitPrice: 145_000 },
      { id: '2', description: 'Барилга байгууламжийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 23_250_000 },
      { id: '3', description: 'Нүүлгэн шилжүүлэлтийн зардал', unit: 'тоо', qty: 1, unitPrice: 2_500_000 },
    ],
  },
  {
    id: '8',
    number: 'НЭХ-2024-008',
    parcelId: 'ГН-2463',
    client: {
      name: 'Дагвадорж Ганзориг',
      address: 'СХД, 5-р хороо, 67-р байр, 9-р тоот',
      phone: '9988-9900',
      register: 'БА93121278',
    },
    date: '2024-02-20',
    due: '2024-03-20',
    status: 'cancelled',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2463)', unit: 'м²', qty: 220, unitPrice: 120_000 },
      { id: '2', description: 'Гэрийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 15_600_000 },
    ],
    notes: 'Гэрчилгээний маргааны улмаас цуцлагдсан',
  },
  {
    id: '9',
    number: 'НЭХ-2024-009',
    parcelId: 'ГН-2464',
    client: {
      name: 'Мөнхбаяр Энхтөр',
      address: 'СХД, 5-р хороо, 345-р байр, 31-р тоот',
      phone: '9900-0011',
      register: 'УА91081589',
    },
    date: '2024-02-25',
    due: '2024-03-25',
    status: 'pending',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2464)', unit: 'м²', qty: 340, unitPrice: 130_000 },
      { id: '2', description: 'Барилга байгууламжийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 23_300_000 },
    ],
    notes: 'Хөрөнгийн үнэлгээний дүгнэлт №УЗ-2024-0134',
  },
  {
    id: '10',
    number: 'НЭХ-2024-010',
    parcelId: 'ГН-2465',
    client: {
      name: 'Сосорбарам Алтанцэцэг',
      address: 'СХД, 5-р хороо, 12-р байр, 2-р тоот',
      phone: '9901-1122',
      register: 'ЭА97050890',
    },
    date: '2024-03-01',
    due: '2024-04-01',
    status: 'paid',
    items: [
      { id: '1', description: 'Газрын нэгж талбарын үнэлгээ (#ГН-2465)', unit: 'м²', qty: 270, unitPrice: 128_000 },
      { id: '2', description: 'Гэрийн нөхөн олговор', unit: 'тоо', qty: 1, unitPrice: 19_240_000 },
    ],
    notes: 'Нөхөн олговрын гэрээ №2024/03/01-010 дагуу',
  },
]
