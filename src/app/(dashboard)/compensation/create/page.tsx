'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney } from '../mock-data'
import { cn } from '@/lib/utils'

interface LineItem {
  id: string
  description: string
  unit: string
  qty: number
  unitPrice: number
}

function makeItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', unit: 'тоо', qty: 1, unitPrice: 0 }
}

const UNITS = ['тоо', 'м²', 'м³', 'ш', 'км'] as const

export default function CreateInvoicePage() {
  const router = useRouter()

  const [items, setItems] = useState<LineItem[]>([makeItem()])
  const [form, setForm] = useState({
    clientName:     '',
    clientRegister: '',
    clientPhone:    '',
    clientAddress:  '',
    parcelId:       '',
    date:           new Date().toISOString().slice(0, 10),
    due:            '',
    notes:          '',
  })

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const vat      = Math.round(subtotal * 0.10)
  const total    = subtotal + vat

  function setField(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setItemField(id: string, key: keyof LineItem, val: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    toast.success('Нэхэмжлэл амжилттай үүслээ')
    router.push('/compensation')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/compensation"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Нэхэмжлэл үүсгэх</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Шинэ нэхэмжлэл бүртгэх</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/compensation"
            className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition-colors"
          >
            Болих
          </Link>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
          >
            <Save className="h-4 w-4" />
            Хадгалах
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">

        {/* Left — main form */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Invoice info */}
          <div className="ap-card p-6">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-4">Нэхэмжлэлийн мэдээлэл</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                  Нэгж талбарын дугаар <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.parcelId}
                  onChange={e => setField('parcelId', e.target.value)}
                  placeholder="ГН-XXXX"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
              </div>
              <div />
              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                  Огноо <span className="text-red-500">*</span>
                </label>
                <input
                  required type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                  Дуусах огноо <span className="text-red-500">*</span>
                </label>
                <input
                  required type="date"
                  value={form.due}
                  onChange={e => setField('due', e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Client info */}
          <div className="ap-card p-6">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-4">Иргэний мэдээлэл</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'clientName',     label: 'Иргэний нэр',          placeholder: 'Овог Нэр',           required: true,  full: false },
                { key: 'clientRegister', label: 'Регистрийн дугаар',     placeholder: 'АА12345678',          required: true,  full: false },
                { key: 'clientPhone',    label: 'Утасны дугаар',         placeholder: '9911-2233',           required: false, full: false },
                { key: 'clientAddress',  label: 'Хаяг',                  placeholder: 'СХД, 5-р хороо, ...', required: false, full: true  },
              ].map(({ key, label, placeholder, required, full }) => (
                <div key={key} className={cn(full && 'col-span-2')}>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    required={required}
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setField(key as keyof typeof form, e.target.value)}
                    placeholder={placeholder}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="ap-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Нэхэмжлэлийн зүйлс</h2>
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, makeItem()])}
                className="flex items-center gap-1.5 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/5 px-3 py-1.5 text-[12px] font-medium text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Зүйл нэмэх
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Тайлбар', 'Нэгж', 'Тоо хэмжээ', 'Нэгжийн үнэ', 'Нийт', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input
                          value={item.description}
                          onChange={e => setItemField(item.id, 'description', e.target.value)}
                          placeholder="Тайлбар оруулах..."
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] outline-none focus:border-[#02c0ce] transition-colors"
                        />
                      </td>
                      <td className="px-3 py-2 w-20">
                        <select
                          value={item.unit}
                          onChange={e => setItemField(item.id, 'unit', e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] bg-white outline-none focus:border-[#02c0ce] transition-colors"
                        >
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 w-28">
                        <input
                          type="number" min="0"
                          value={item.qty}
                          onChange={e => setItemField(item.id, 'qty', Math.max(0, +e.target.value))}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] text-right outline-none focus:border-[#02c0ce] transition-colors"
                        />
                      </td>
                      <td className="px-3 py-2 w-36">
                        <input
                          type="number" min="0"
                          value={item.unitPrice}
                          onChange={e => setItemField(item.id, 'unitPrice', Math.max(0, +e.target.value))}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] text-right outline-none focus:border-[#02c0ce] transition-colors"
                        />
                      </td>
                      <td className="px-3 py-2 w-36 tabular-nums font-semibold text-slate-800 text-right">
                        {fmtMoney(item.qty * item.unitPrice)}
                      </td>
                      <td className="px-3 py-2 w-8">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div className="mt-5">
              <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Тэмдэглэл</label>
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={3}
                placeholder="Нэмэлт тайлбар эсвэл гэрээний дугаар..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right — summary */}
        <div className="flex flex-col gap-5">
          <div className="ap-card p-6">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-4">Нийт дүн</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">Дэд нийт</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmtMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">НӨАТ (10%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmtMoney(vat)}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between items-baseline">
                <span className="text-[14px] font-bold text-slate-800">Нийт</span>
                <span className="text-[20px] font-black tabular-nums" style={{ color: '#02c0ce' }}>
                  {fmtMoney(total)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#02c0ce] py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
            >
              <Save className="h-4 w-4" />
              Нэхэмжлэл үүсгэх
            </button>
            <Link
              href="/compensation"
              className="mt-2 flex items-center justify-center rounded-xl border border-slate-200 py-2.5 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition-colors"
            >
              Болих
            </Link>
          </div>

          {/* Status selector */}
          <div className="ap-card p-6">
            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-3">Анхны төлөв</h2>
            <div className="space-y-2">
              {[
                { value: 'pending', label: 'Хүлээгдэж буй', color: '#f9bc0b', bg: '#f9bc0b1a' },
                { value: 'paid',    label: 'Төлөгдсөн',     color: '#0acf97', bg: '#0acf971a' },
              ].map(({ value, label, color, bg }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-slate-300 transition-colors has-[:checked]:border-[#02c0ce]/40 has-[:checked]:bg-[#02c0ce]/5"
                >
                  <input type="radio" name="status" value={value} defaultChecked={value === 'pending'} className="accent-[#02c0ce]" />
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ color, background: bg }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
