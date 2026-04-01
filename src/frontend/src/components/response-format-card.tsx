import { useState } from "react"
import { ChevronDown, ChevronRight, FileJson } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface SchemaFieldProps {
  name: string
  schema: any
  required?: string[]
  depth?: number
  defs?: Record<string, any>
}

function SchemaField({ name, schema, required = [], depth = 0, defs = {} }: SchemaFieldProps) {
  const [isOpen, setIsOpen] = useState(depth < 2) // Auto-expand first 2 levels
  
  const isRequired = required.includes(name)
  
  // Resolve $ref if present
  const resolvedSchema = schema.$ref 
    ? resolveRef(schema.$ref, defs) || schema
    : schema
  
  const hasChildren = resolvedSchema.properties || 
    (resolvedSchema.type === 'array' && (
      resolvedSchema.items?.properties || 
      (resolvedSchema.items?.$ref && resolveRef(resolvedSchema.items.$ref, defs))
    ))
  
  const description = resolvedSchema.description
  
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: 'text-green-600',
      number: 'text-blue-600',
      integer: 'text-blue-600',
      boolean: 'text-purple-600',
      array: 'text-orange-600',
      object: 'text-red-600',
    }
    return colors[type] || 'text-gray-600'
  }
  
  const formatType = (schema: any): string => {
    if (schema.type === 'array') {
      if (schema.items?.$ref) {
        const refName = schema.items.$ref.split('/').pop()
        return `Array<${refName}>`
      }
      const itemsType = schema.items?.type || 'any'
      return `Array<${itemsType}>`
    }
    if (schema.enum) {
      return schema.enum.map((v: any) => JSON.stringify(v)).join(' | ')
    }
    return schema.type || 'any'
  }
  
  const indent = depth * 16
  
  // Get the display name (use ref name if this is a referenced type)
  const displayName = schema.$ref 
    ? schema.$ref.split('/').pop() || name
    : name
  
  return (
    <div className="py-1">
      <div 
        className="flex items-center gap-1 hover:bg-muted/50 rounded px-2 py-1 cursor-pointer transition-colors"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
          >
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}
        
        <span className="font-mono text-sm font-medium">{displayName}</span>
        {isRequired && (
          <Badge variant="destructive" className="h-4 text-[9px] px-1">required</Badge>
        )}
        <span className={`font-mono text-sm ${getTypeColor(resolvedSchema.type)}`}>
          : {formatType(resolvedSchema)}
        </span>
      </div>
      
      {description && (
        <div 
          className="text-xs text-muted-foreground italic ml-6 mr-2"
          style={{ paddingLeft: `${indent}px` }}
        >
          {description}
        </div>
      )}
      
      {isOpen && hasChildren && (
        <div>
          {/* Handle array with $ref items */}
          {resolvedSchema.type === 'array' && resolvedSchema.items?.$ref && (
            (() => {
              const refSchema = resolveRef(resolvedSchema.items.$ref, defs)
              if (refSchema?.properties) {
                return Object.entries(refSchema.properties).map(([childName, childSchema]) => (
                  <SchemaField
                    key={childName}
                    name={childName}
                    schema={childSchema as any}
                    required={refSchema.required || []}
                    depth={depth + 1}
                    defs={defs}
                  />
                ))
              }
              return null
            })()
          )}
          
          {/* Handle array with inline properties */}
          {resolvedSchema.type === 'array' && resolvedSchema.items?.properties && !resolvedSchema.items?.$ref && (
            Object.entries(resolvedSchema.items.properties).map(([childName, childSchema]) => (
              <SchemaField
                key={childName}
                name={childName}
                schema={childSchema as any}
                required={resolvedSchema.items.required || []}
                depth={depth + 1}
                defs={defs}
              />
            ))
          )}
          
          {/* Handle object properties */}
          {resolvedSchema.properties && (
            Object.entries(resolvedSchema.properties).map(([childName, childSchema]) => (
              <SchemaField
                key={childName}
                name={childName}
                schema={childSchema as any}
                required={resolvedSchema.required || []}
                depth={depth + 1}
                defs={defs}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function resolveRef(ref: string, defs: Record<string, any>) {
  // Handle #/$defs/Name format
  if (ref.startsWith('#/$defs/')) {
    const defName = ref.split('/').pop()
    return defs[defName || '']
  }
  // Handle #/definitions/Name format (older JSON Schema draft)
  if (ref.startsWith('#/definitions/')) {
    const defName = ref.split('/').pop()
    return defs[defName || '']
  }
  return null
}

interface ResponseFormatCardProps {
  responseFormat?: {
    type: string
    json_schema?: {
      name?: string
      schema?: {
        type?: string
        properties?: Record<string, any>
        required?: string[]
        items?: any
        description?: string
        $defs?: Record<string, any>
        definitions?: Record<string, any>
      }
    }
  }
}

export function ResponseFormatCard({ responseFormat }: ResponseFormatCardProps) {
  if (!responseFormat || !responseFormat.json_schema?.schema) {
    return null
  }
  
  const schema = responseFormat.json_schema.schema
  const schemaName = responseFormat.json_schema.name || 'Schema'
  const schemaDescription = schema.description
  
  // Merge $defs and definitions for compatibility
  const defs = { ...schema.$defs, ...schema.definitions }
  
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 mb-1">
          <FileJson className="h-4 w-4" />
          <span className="font-semibold text-sm">Response Format: {schemaName}</span>
        </div>
        {schemaDescription && (
          <p className="text-xs text-muted-foreground">{schemaDescription}</p>
        )}
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {schema.properties && Object.entries(schema.properties).map(([name, propSchema]) => (
          <SchemaField
            key={name}
            name={name}
            schema={propSchema as any}
            required={schema.required || []}
            depth={0}
            defs={defs}
          />
        ))}
      </div>
    </div>
  )
}
