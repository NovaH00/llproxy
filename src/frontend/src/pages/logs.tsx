import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Trash2, RefreshCw, Search } from "lucide-react"
import { formatTime, formatRelativeTime } from "@/lib/time"
import { CopyButton } from "@/components/copy-button"

export function Logs() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")

  // Restore selected log ID from localStorage on mount
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem("logs_selected_id")
    return saved ? Number(saved) : null
  })

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["logs"],
    queryFn: () => api.logs.list({
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

  const requestHeadersStr = useMemo(() => 
    selectedLog?.request_headers ? JSON.stringify(selectedLog.request_headers, null, 2) : ""
  , [selectedLog])

  const responseHeadersStr = useMemo(() => 
    selectedLog?.response_headers ? JSON.stringify(selectedLog.response_headers, null, 2) : ""
  , [selectedLog])

  const requestBodyStr = useMemo(() => {
    if (!selectedLog) return ""
    if (selectedLog.request_body) return JSON.stringify(selectedLog.request_body, null, 2)
    if (selectedLog.request_body_raw) {
      try {
        return JSON.stringify(JSON.parse(selectedLog.request_body_raw), null, 2)
      } catch {
        return selectedLog.request_body_raw
      }
    }
    return ""
  }, [selectedLog])

  const responseBodyStr = useMemo(() => {
    if (!selectedLog) return ""
    if (selectedLog.is_stream) return selectedLog.response_body_raw || ""
    if (selectedLog.response_body) return JSON.stringify(selectedLog.response_body, null, 2)
    if (selectedLog.response_body_raw) {
      try {
        return JSON.stringify(JSON.parse(selectedLog.response_body_raw), null, 2)
      } catch {
        return selectedLog.response_body_raw
      }
    }
    return ""
  }, [selectedLog])

  // Save to localStorage when selectedId changes
  useEffect(() => {
    if (selectedId !== null) {
      localStorage.setItem("logs_selected_id", selectedId.toString())
    }
  }, [selectedId])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.logs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
      setSelectedId(null)
    },
  })

  const getMethodBadge = (method: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      POST: "default",
      GET: "secondary",
      PUT: "outline",
      DELETE: "destructive",
    }
    return (
      <span className="inline-flex items-center">
        <Badge variant={variants[method] || "outline"} className="flex items-center justify-center h-5 px-2 text-sm leading-none">
          {method}
        </Badge>
      </span>
    )
  }

  if (selectedLog) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              localStorage.removeItem("logs_selected_id")
              setSelectedId(null)
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Log #{selectedLog.id}</h1>
              <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
                {getMethodBadge(selectedLog.method)}
                <span>{selectedLog.provider}{selectedLog.path}</span>
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

        <Card className="flex-shrink-0 mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Time</div>
                <div className="font-medium">{formatTime(selectedLog.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Model</div>
                <div className="truncate" title={selectedLog.model || ""}>{selectedLog.model || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Latency</div>
                <div className="font-medium">
                  {selectedLog.latency_ms ? `${selectedLog.latency_ms}ms` : selectedLog.total_duration_ms ? `${selectedLog.total_duration_ms}ms` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Duration</div>
                <div className="font-medium">
                  {selectedLog.total_duration_ms ? `${selectedLog.total_duration_ms}ms` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Response</div>
                <Badge variant={selectedLog.response_status && selectedLog.response_status >= 400 ? "destructive" : "success"}>
                  {selectedLog.response_status || "N/A"}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Streaming</div>
                <Badge variant={selectedLog.is_stream ? "default" : "secondary"}>
                  {selectedLog.is_stream ? "Yes" : "No"}
                </Badge>
              </div>
              {selectedLog.is_stream && (
                <div>
                  <div className="text-sm text-muted-foreground">Chunks</div>
                  <div className="font-medium">{selectedLog.chunk_count}</div>
                </div>
              )}
              {selectedLog.error_message && (
                <div className="col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-muted-foreground">Error</div>
                    <CopyButton value={selectedLog.error_message} className="h-6 w-6" />
                  </div>
                  <div className="text-sm text-red-500 font-mono">{selectedLog.error_message}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0">
          <Card className="flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-lg">Request</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Headers</h4>
                  {requestHeadersStr && <CopyButton value={requestHeadersStr} className="h-6 w-6" />}
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto h-36">
                  {requestHeadersStr || "No headers"}
                </pre>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Body</h4>
                  {requestBodyStr && <CopyButton value={requestBodyStr} className="h-6 w-6" />}
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1 min-h-0">
                  {requestBodyStr || "No body"}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-lg">Response</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Headers</h4>
                  {responseHeadersStr && <CopyButton value={responseHeadersStr} className="h-6 w-6" />}
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-36">
                  {responseHeadersStr || "No headers"}
                </pre>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">
                    Body {selectedLog.is_stream && <span className="text-muted-foreground font-normal">({selectedLog.chunk_count} chunks)</span>}
                  </h4>
                  {responseBodyStr && <CopyButton value={responseBodyStr} className="h-6 w-6" />}
                </div>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1 min-h-0">
                  {responseBodyStr || "No body"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">View and manage proxied requests</p>
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
                placeholder="Search logs..."
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
                  <TableHead>Method</TableHead>
                  <TableHead>Upstream URL</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No logs match your search" : "No logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs?.map((log) => (
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
                      <TableCell>{getMethodBadge(log.method)}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]" title={log.provider || ""}>
                        {log.provider || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {log.path}
                      </TableCell>
                      <TableCell className="text-sm">{log.model || "-"}</TableCell>
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
