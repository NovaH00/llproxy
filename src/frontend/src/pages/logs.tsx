import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Trash2, RefreshCw, Search } from "lucide-react"

export function Logs() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    path: "",
    model: "",
    provider: "",
    method: "",
  })
  
  // Restore selected log ID from localStorage on mount
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem("logs_selected_id")
    return saved ? Number(saved) : null
  })

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["logs", filters],
    queryFn: () => api.logs.list({
      limit: 100,
      path: filters.path || undefined,
      model: filters.model || undefined,
      provider: filters.provider || undefined,
      method: filters.method || undefined,
    }),
    refetchInterval: 5000,
  })

  const selectedLog = logs?.find(log => log.id === selectedId) || null

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

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    const time = date.toLocaleTimeString(undefined, { hour12: false })
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${time} ${day}-${month}-${year}`
  }

  const getMethodBadge = (method: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      POST: "default",
      GET: "secondary",
      PUT: "outline",
      DELETE: "destructive",
    }
    return <Badge variant={variants[method] || "outline"}>{method}</Badge>
  }

  if (selectedLog) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              localStorage.removeItem("logs_selected_id")
              setSelectedId(null)
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Log #{selectedLog.id}</h1>
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

        <Card className="flex-shrink-0 mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Time</div>
                <div className="font-medium">{formatTime(selectedLog.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Method</div>
                <div>{getMethodBadge(selectedLog.method)}</div>
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
                <h4 className="text-sm font-medium mb-2">Headers</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto h-36">
                  {selectedLog.request_headers
                    ? JSON.stringify(selectedLog.request_headers, null, 2)
                    : "No headers"}
                </pre>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <h4 className="text-sm font-medium mb-2">Body</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1 min-h-0">
                  {(() => {
                    // For request body, try to pretty print JSON
                    if (selectedLog.request_body) {
                      return JSON.stringify(selectedLog.request_body, null, 2)
                    }
                    
                    // Fallback: try to parse raw body as JSON for pretty printing
                    if (selectedLog.request_body_raw) {
                      try {
                        const parsed = JSON.parse(selectedLog.request_body_raw)
                        return JSON.stringify(parsed, null, 2)
                      } catch {
                        // Not valid JSON, show as-is
                        return selectedLog.request_body_raw
                      }
                    }
                    
                    return "No body"
                  })()}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center ">
                <CardTitle className="text-lg mr-4">Response</CardTitle>
                <Badge variant={selectedLog.response_status && selectedLog.response_status >= 400 ? "destructive" : "success"}>
                  {selectedLog.response_status || "N/A"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col gap-4">
              <div className="flex-shrink-0">
                <h4 className="text-sm font-medium mb-2">Headers</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-36">
                  {selectedLog.response_headers
                    ? JSON.stringify(selectedLog.response_headers, null, 2)
                    : "No headers"}
                </pre>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <h4 className="text-sm font-medium mb-2">
                  Body {selectedLog.is_stream && <span className="text-muted-foreground font-normal">({selectedLog.chunk_count} chunks)</span>}
                </h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1 min-h-0">
                  {(() => {
                    // For streaming responses, show raw SSE format
                    if (selectedLog.is_stream) {
                      return selectedLog.response_body_raw || "No body"
                    }
                    
                    // For non-streaming JSON responses, try to pretty print
                    if (selectedLog.response_body) {
                      return JSON.stringify(selectedLog.response_body, null, 2)
                    }
                    
                    // Fallback: try to parse raw body as JSON for pretty printing
                    if (selectedLog.response_body_raw) {
                      try {
                        const parsed = JSON.parse(selectedLog.response_body_raw)
                        return JSON.stringify(parsed, null, 2)
                      } catch {
                        // Not valid JSON, show as-is
                        return selectedLog.response_body_raw
                      }
                    }
                    
                    return "No body"
                  })()}
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
              className="w-40"
            />
            <Input
              placeholder="Provider"
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className="w-40"
            />
            <Input
              placeholder="Method"
              value={filters.method}
              onChange={(e) => setFilters({ ...filters, method: e.target.value })}
              className="w-24"
            />
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
                  <TableHead>Latency</TableHead>
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
                      No logs found
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
                      <TableCell>{getMethodBadge(log.method)}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]" title={log.provider || ""}>
                        {log.provider || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {log.path}
                      </TableCell>
                      <TableCell className="text-sm">{log.model || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {log.latency_ms ? `${log.latency_ms}ms` : log.total_duration_ms ? `${log.total_duration_ms}ms` : "-"}
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
