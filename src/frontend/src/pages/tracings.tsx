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
import { formatTime, formatRelativeTime } from "@/lib/time"

export function Tracings() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")

  // Restore selected log ID from localStorage on mount
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem("tracings_selected_id")
    return saved ? Number(saved) : null
  })

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["tracings"],
    queryFn: () => api.logs.listTracings({
      limit: 100,
    }),
    refetchInterval: 5000,
  })

  // Client-side filtering with partial match
  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const searchFields = [
      log.id.toString(),
      log.path || "",
      log.model || "",
      log.provider || "",
      log.method || "",
      log.response_status?.toString() || "",
      log.error_message || "",
      log.request_body_raw || "",
      log.response_body_raw || "",
    ]
    return searchFields.some((field) => field.toLowerCase().includes(query))
  })

  const selectedLog = filteredLogs?.find(log => log.id === selectedId) || null

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

  const getMessageCount = (log: LogEntry) => {
    const requestMessages = log.request_body?.messages?.length || 0
    const hasAssistantResponse = !!(
      log.response_body?.choices?.[0]?.message?.content ||
      log.response_body_raw?.includes('"content"')
    )
    return requestMessages + (hasAssistantResponse ? 1 : 0)
  }

  const getProcessedTokens = (log: LogEntry): { input: number; output: number } | null => {
    // Try to get from parsed response body usage
    if (log.response_body?.usage) {
      return {
        input: log.response_body.usage.prompt_tokens || 0,
        output: log.response_body.usage.completion_tokens || 0,
      }
    }

    // Try to get from raw stream timings
    if (log.response_body_raw) {
      const lines = log.response_body_raw.split("\n")
      for (const line of lines.reverse()) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const chunk = JSON.parse(line.slice(6))
            if (chunk.timings) {
              return {
                input: chunk.timings.prompt_n || 0,
                output: chunk.timings.predicted_n || 0,
              }
            }
          } catch {
            continue
          }
        }
      }
    }

    return null
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
              <p className="text-muted-foreground font-mono text-sm">
                {selectedLog.provider}{selectedLog.path}
              </p>
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
            {/* Performance & Metadata - half height */}
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Performance & Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto min-h-0">
                <MetadataView log={selectedLog} />
              </CardContent>
            </Card>

            {/* Response Format Card - half height */}
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
                placeholder="Search tracings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
                  <TableHead>Processed Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No tracings match your search" : "No tracings found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs?.map((log) => {
                    const tokens = getProcessedTokens(log)
                    return (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(log.id)}
                    >
                      <TableCell className="font-mono text-sm">#{log.id}</TableCell>
                      <TableCell className="text-sm">
                        <div className="text-foreground font-medium">{formatTime(log.created_at)}</div>
                        <div className="text-xs text-blue-500 dark:text-blue-400">{formatRelativeTime(log.created_at)}</div>
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
                        {tokens ? (
                          <span>
                            <span className="text-blue-500 dark:text-blue-400">{tokens.input}</span>
                            {" + "}
                            <span className="text-green-500 dark:text-green-400">{tokens.output}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
