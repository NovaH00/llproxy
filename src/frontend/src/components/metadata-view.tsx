import type { LogEntry } from "@/types"

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
    { label: "Input Tokens", value: timings?.prompt_n?.toLocaleString() || "N/A" },
    { label: "Output Tokens", value: timings?.predicted_n?.toLocaleString() || "N/A" },
    { label: "Total Tokens", value: timings ? ((timings.prompt_n || 0) + (timings.predicted_n || 0)).toLocaleString() : "N/A" },
    { label: "Cache Hits", value: timings?.cache_n?.toLocaleString() || "0" },
    { label: "Prompt Speed", value: timings?.prompt_per_second ? `${timings.prompt_per_second.toFixed(2)} tok/s` : "N/A" },
    { label: "Generation Speed", value: timings?.predicted_per_second ? `${timings.predicted_per_second.toFixed(2)} tok/s` : "N/A" },
    { label: "Time to First Token", value: log.latency_ms ? `${log.latency_ms}ms` : "N/A" },
    { label: "Total Duration", value: log.total_duration_ms ? `${log.total_duration_ms}ms` : "N/A" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
