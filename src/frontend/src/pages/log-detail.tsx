import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Trash2, Clock, Server, Database } from "lucide-react"

export function LogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: log, isLoading } = useQuery({
    queryKey: ["log", id],
    queryFn: () => api.logs.get(Number(id)),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.logs.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
      navigate("/logs")
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!log) {
    return <div className="text-center py-8 text-muted-foreground">Log not found</div>
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    const time = date.toLocaleTimeString('en-GB', { hour12: false })
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${time} ${day}/${month}/${year}`
  }

  const formatJSON = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/logs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Log #{log.id}</h1>
            <p className="text-muted-foreground font-mono text-sm">{log.path}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6 flex-shrink-0">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Time</span>
            </div>
            <p className="font-medium">{formatTime(log.created_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Server className="h-4 w-4" />
              <span className="text-sm">Method</span>
            </div>
            <Badge>{log.method}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-4 w-4" />
              <span className="text-sm">Model</span>
            </div>
            <p className="font-medium truncate" title={log.model || ""}>{log.model || "N/A"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{log.is_stream ? "TTFT" : "Latency"}</span>
            </div>
            <p className="font-medium">
              {log.latency_ms ? `${log.latency_ms}ms` : log.total_duration_ms ? `${log.total_duration_ms}ms` : "N/A"}
            </p>
            {log.is_stream && log.total_duration_ms && (
              <p className="text-xs text-muted-foreground mt-1">
                Total: {log.total_duration_ms}ms
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 flex-1 min-h-0">
        <Card className="flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-lg">Request</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
            <div className="flex-shrink-0">
              <h4 className="text-sm font-medium mb-2">Headers</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-24">
                {formatJSON(log.request_headers)}
              </pre>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <h4 className="text-sm font-medium mb-2">Body</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1">
                {log.request_body
                  ? formatJSON(log.request_body)
                  : log.request_body_raw || "No body"}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-lg">Response</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
            <div className="flex-shrink-0">
              <div className="flex gap-4 mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>{" "}
                  <Badge variant={log.response_status && log.response_status >= 400 ? "destructive" : "success"}>
                    {log.response_status || "N/A"}
                  </Badge>
                </div>
                {log.is_stream && (
                  <div>
                    <span className="text-sm text-muted-foreground">Chunks:</span>{" "}
                    <span className="font-medium">{log.chunk_count}</span>
                  </div>
                )}
              </div>
              <h4 className="text-sm font-medium mb-2">Headers</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-24">
                {formatJSON(log.response_headers)}
              </pre>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <h4 className="text-sm font-medium mb-2">Body</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto flex-1">
                {log.response_body
                  ? formatJSON(log.response_body)
                  : log.response_body_raw || "No body"}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {log.error_message && (
        <Card className="border-destructive mt-4 flex-shrink-0">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-destructive/10 p-3 rounded-md text-sm text-destructive">
              {log.error_message}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
