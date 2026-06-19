'use client'
import { Eye, EyeOff, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface LayerConfig {
  id: string
  label: string
  visible: boolean
  color: string
}

interface LayerPanelProps {
  layers: LayerConfig[]
  onToggle: (id: string) => void
}

export default function LayerPanel({ layers, onToggle }: LayerPanelProps) {
  return (
    <Card className="absolute top-4 right-4 z-10 w-56 shadow-lg">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4" />Давхаргууд
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            className={`w-full flex items-center gap-2.5 p-2 rounded-md text-sm text-left transition-colors ${layer.visible ? 'hover:bg-muted/60' : 'opacity-50 hover:bg-muted/40'}`}
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 border"
              style={{ backgroundColor: layer.color, borderColor: layer.color }}
            />
            <span className="flex-1 font-medium">{layer.label}</span>
            {layer.visible
              ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
