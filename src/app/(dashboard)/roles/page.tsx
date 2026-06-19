'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rolesApi, permissionsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, Plus, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RolesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  })
  const { data: permsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.list(),
  })

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => rolesApi.create({ name }),
    onSuccess: () => {
      toast.success('Роль үүслээ')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowCreate(false); setNewName('')
    },
  })
  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      toast.success('Устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setSelectedRole(null)
    },
  })
  const assignPermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) =>
      rolesApi.assignPermission(roleId, permId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: () => toast.error('Эрх нэмэхэд алдаа'),
  })
  const removePermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) =>
      rolesApi.removePermission(roleId, permId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })

  const role = rolesData?.data.find(r => r.id === selectedRole)
  const assignedIds = new Set(role?.permissions.map(p => p.id) ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Эрх & Роль</h2>
          <p className="text-muted-foreground">Системийн хандалтын эрхийн тохиргоо</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)}>
          {showCreate ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          Роль нэмэх
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Input
                placeholder="Ролийн нэр"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="max-w-xs"
                onKeyDown={e => e.key === 'Enter' && newName.trim() && createRoleMutation.mutate(newName.trim())}
              />
              <Button onClick={() => newName.trim() && createRoleMutation.mutate(newName.trim())}>Үүсгэх</Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewName('') }}>Болих</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ролиуд</p>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : rolesData?.data.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id === selectedRole ? null : r.id)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border text-left transition-all ${r.id === selectedRole ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card hover:bg-muted/50'}`}
            >
              <div className="flex items-center gap-3">
                <Shield className={`h-4 w-4 ${r.id === selectedRole ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.permissions.length} эрх</p>
                </div>
              </div>
              <Button
                size="icon" variant="ghost"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={e => { e.stopPropagation(); if (confirm('Устгах уу?')) deleteRoleMutation.mutate(r.id) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selectedRole ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              Роль сонгоно уу
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{role?.name}</CardTitle>
                <CardDescription>Дарж эрх нэмэх / хасах</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {permsData?.data.map(perm => {
                    const has = assignedIds.has(perm.id)
                    return (
                      <button
                        key={perm.id}
                        onClick={() => {
                          if (has) removePermMutation.mutate({ roleId: selectedRole, permId: perm.id })
                          else assignPermMutation.mutate({ roleId: selectedRole, permId: perm.id })
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${has ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50 border-transparent hover:border-border'}`}
                      >
                        <span className="font-mono text-xs">{perm.name}</span>
                        {has && <Badge className="text-xs px-1.5 py-0 h-5">✓</Badge>}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
