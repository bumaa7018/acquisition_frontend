'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { UserPlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const createSchema = z.object({
  email: z.string().email('Имэйл буруу'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
  first_name: z.string().min(1, 'Нэр оруулна уу'),
  last_name: z.string().min(1, 'Овог оруулна уу'),
})
type CreateForm = z.infer<typeof createSchema>

export default function UsersPage() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ page: 1, page_size: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateForm) => usersApi.create(body),
    onSuccess: () => {
      toast.success('Хэрэглэгч үүслээ')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      reset()
    },
    onError: () => toast.error('Үүсгэхэд алдаа гарлаа'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('Устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Устгах боломжгүй'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const fields: [keyof CreateForm, string, string][] = [
    ['first_name', 'Нэр', 'text'],
    ['last_name', 'Овог', 'text'],
    ['email', 'Имэйл', 'email'],
    ['password', 'Нууц үг', 'password'],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Хэрэглэгчид</h2>
          <p className="text-muted-foreground">Нийт {data?.total ?? 0} хэрэглэгч</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)}>
          {showCreate ? <X className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
          {showCreate ? 'Болих' : 'Нэмэх'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="grid grid-cols-2 gap-4">
              {fields.map(([field, label, type]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input type={type} {...register(field)} />
                  {errors[field] && <p className="text-xs text-red-500">{errors[field]?.message}</p>}
                </div>
              ))}
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>Үүсгэх</Button>
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset() }}>Болих</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {['Хэрэглэгч', 'Имэйл', 'Роль', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.data.map(user => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                            {user.first_name?.[0]?.toUpperCase()}
                          </div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.map(r => <Badge key={r.id} variant="secondary">{r.name}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => { if (confirm('Устгах уу?')) deleteMutation.mutate(user.id) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
