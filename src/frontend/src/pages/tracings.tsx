import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LogEntry } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, RefreshCw, Search, MessageSquare, Cpu, Trash2 } from "lucide-react"
import { ConversationView } from "@/components/conversation-view"
import { MetadataView } from "@/components/metadata-view"
import { ResponseFormatCard } from "@/components/response-format-card"

export function Tracings() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    path: "",
    model: "",
  })
  
  // Restore selected log ID from localStorage on mount
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem("tracings_selected_id")
    return saved ? Number(saved) : null
  })

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["tracings", filters],
    queryFn: () => api.logs.listTracings({
      limit: 100,
    }),
    refetchInterval: 5000,
  })

  const selectedLog = logs?.find(log => log.id === selectedId) || null

  // Save to localStorage when selectedId changes
  useEffect(() => {
    if (selectedId !== null) {
      localStorage.setItem("tracings_selected_id", selectedId.toString())
    }
  }, [selectedId])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.logs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracings"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
      setSelectedId(null)
    },
  })

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    const time = date.toLocaleTimeString(undefined, { hour12: false })
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${time} ${day}-${month}-${year}`
  }

  const getMessageCount = (log: LogEntry) => {
    const requestMessages = log.request_body?.messages?.length || 0
    const hasAssistantResponse = !!(
      log.response_body?.choices?.[0]?.message?.content ||
      log.response_body_raw?.includes('"content"')
    )
    return requestMessages + (hasAssistantResponse ? 1 : 0)
  }

  const getTokenCount = (log: LogEntry): string => {
    // First try to get from parsed response body (non-streaming)
    if (log.response_body?.usage) {
      const usage = log.response_body.usage
      const input = usage.prompt_tokens || 0
      const output = usage.completion_tokens || 0
      if (input > 0 || output > 0) {
        return `${input}+${output}`
      }
    }
    
    // For streaming responses, extract from timings in the last chunk
    if (log.response_body_raw) {
      const lines = log.response_body_raw.split("\n")
      for (const line of lines.reverse()) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const chunk = JSON.parse(line.slice(6))
            if (chunk.timings) {
              const input = chunk.timings.prompt_n || 0
              const output = chunk.timings.predicted_n || 0
              return `${input}+${output}`
            }
          } catch {
            continue
          }
        }
      }
    }
    return "-"
  }

  if (selectedLog) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              localStorage.removeItem("tracings_selected_id")
              setSelectedId(null)
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tracing #{selectedLog.id}</h1>
              <p className="text-muted-foreground font-mono text-sm">{selectedLog.path}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => deleteMutation.mutate(selectedLog.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
          <div className="lg:col-span-2 min-h-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto min-h-0">
                <ConversationView log={selectedLog} />
              </CardContent>
            </Card>
          </div>

          <div className="min-h-0 flex flex-col gap-4">
            {/* Performance & Metadata - fits content */}
            <Card className="flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Performance & Metadata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetadataView log={selectedLog} />
              </CardContent>
            </Card>

            {/* Response Format Card - takes remaining space */}
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardContent className="flex-1 overflow-auto min-h-0 p-0">
                <ResponseFormatCard responseFormat={selectedLog.request_body?.response_format} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tracings</h1>
          <p className="text-muted-foreground">Debug LLM conversations and performance</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="pt-6 flex-1 flex flex-col min-h-0">
          <div className="flex gap-4 mb-4 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by path..."
                value={filters.path}
                onChange={(e) => setFilters({ ...filters, path: e.target.value })}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="Model"
              value={filters.model}
              onChange={(e) => setFilters({ ...filters, model: e.target.value })}
              className="w-64"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Upstream URL</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No tracings found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(log.id)}
                    >
                      <TableCell className="font-mono text-sm">#{log.id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(log.created_at)}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]" title={log.provider || ""}>
                        {log.provider || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {log.path}
                      </TableCell>
                      <TableCell className="text-sm">{log.model || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getMessageCount(log)} msgs
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {getTokenCount(log)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
