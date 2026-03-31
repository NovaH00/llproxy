import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { LogEntry } from "@/types"
import { FileJson } from "lucide-react"

interface MetadataViewProps {
  log: LogEntry
}

interface Timings {
  cache_n?: number
  prompt_n?: number
  prompt_ms?: number
  prompt_per_token_ms?: number
  prompt_per_second?: number
  predicted_n?: number
  predicted_ms?: number
  predicted_per_token_ms?: number
  predicted_per_second?: number
}

// Simplify JSON schema for display
function simplifySchema(schema: any, depth = 0): string {
  if (!schema) return ""
  
  const indent = "  ".repeat(depth)
  
  if (schema.type === "object") {
    const props = schema.properties || {}
    const required = schema.required || []
    const lines = ["{"]
    
    for (const [key, value] of Object.entries(props)) {
      const propSchema = value as any
      const isRequired = required.includes(key)
      const optional = isRequired ? "" : "?"
      const type = simplifySchema(propSchema, depth + 1)
      lines.push(`${indent}  ${key}${optional}: ${type}`)
    }
    
    lines.push(`${indent}}`)
    return lines.join("\n")
  }
  
  if (schema.type === "array") {
    const items = schema.items as any
    return `Array<${simplifySchema(items, depth)}>`
  }
  
  if (schema.enum) {
    return schema.enum.map((v: any) => JSON.stringify(v)).join(" | ")
  }
  
  return schema.type || "any"
}

// Format response_format for display
function formatResponseFormat(responseFormat: any): string | null {
  if (!responseFormat) return null
  
  if (responseFormat.type === "json_schema" && responseFormat.json_schema) {
    const schema = responseFormat.json_schema.schema
    const name = responseFormat.json_schema.name || "Schema"
    return `${name}: ${simplifySchema(schema)}`
  }
  
  if (responseFormat.type === "json_object") {
    return "JSON Object"
  }
  
  if (responseFormat.type) {
    return responseFormat.type
  }
  
  return null
}

export function MetadataView({ log }: MetadataViewProps) {
  // Extract timings from the last chunk of response
  let timings: Timings | null = null
  
  if (log.response_body_raw) {
    const lines = log.response_body_raw.split("\n")
    for (const line of lines.reverse()) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const chunk = JSON.parse(line.slice(6))
          if (chunk.timings) {
            timings = chunk.timings
            break
          }
        } catch {
          continue
        }
      }
    }
  }

  // Also check parsed response body
  if (!timings && log.response_body) {
    const raw = log.response_body as unknown as { timings?: Timings }
    timings = raw.timings || null
  }

  const stats = [
    {
      label: "Input Tokens",
      value: timings?.prompt_n?.toLocaleString() || "N/A",
    },
    {
      label: "Output Tokens",
      value: timings?.predicted_n?.toLocaleString() || "N/A",
    },
    {
      label: "Total Tokens",
      value: timings 
        ? ((timings.prompt_n || 0) + (timings.predicted_n || 0)).toLocaleString()
        : "N/A",
    },
    {
      label: "Cache Hits",
      value: timings?.cache_n?.toLocaleString() || "0",
    },
  ]

  const performanceStats = [
    {
      label: "Prompt Speed",
      value: timings?.prompt_per_second 
        ? `${timings.prompt_per_second.toFixed(2)} tok/s`
        : "N/A",
    },
    {
      label: "Generation Speed",
      value: timings?.predicted_per_second
        ? `${timings.predicted_per_second.toFixed(2)} tok/s`
        : "N/A",
    },
    {
      label: "Time to First Token",
      value: log.latency_ms ? `${log.latency_ms}ms` : "N/A",
    },
    {
      label: "Total Duration",
      value: log.total_duration_ms ? `${log.total_duration_ms}ms` : "N/A",
    },
  ]

  const formattedSchema = formatResponseFormat(log.request_body?.response_format)

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 overflow-auto flex-1 pr-2">
        {/* Token Stats */}
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="text-lg font-semibold">{stat.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        {/* Performance Stats */}
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {performanceStats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="text-lg font-semibold">{stat.value}</div>
                </div>
              ))}
            </div>
          </CardContent>

        {/* Response Format */}
        {formattedSchema && (
          <>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Response Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs">
                  {log.request_body?.response_format?.type === "json_schema" 
                    ? "JSON Schema" 
                    : log.request_body?.response_format?.type || "Unknown"}
                </Badge>
                {log.request_body?.response_format?.json_schema?.name && (
                  <Badge variant="outline" className="text-xs">
                    {log.request_body.response_format.json_schema.name}
                  </Badge>
                )}
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-64">
                {formattedSchema}
              </pre>
            </CardContent>
          </>
        )}
      </div>
    </div>
  )
}
