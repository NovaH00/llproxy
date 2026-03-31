import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Settings as SettingsType } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Trash2, Plus, X } from "lucide-react"

export function Settings() {
  const queryClient = useQueryClient()
  const [upstreamUrl, setUpstreamUrl] = useState<string>("")
  const [tracingPaths, setTracingPaths] = useState<string[]>(["/v1/chat/completions"])
  const [newPath, setNewPath] = useState("")

  const { data: settings, isLoading } = useQuery<SettingsType>({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
  })

  useEffect(() => {
    if (settings?.upstream_url) {
      setUpstreamUrl(settings.upstream_url)
    }
    if (settings?.tracing_paths) {
      setTracingPaths(settings.tracing_paths)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () => api.settings.set({ 
      upstream_url: upstreamUrl,
      tracing_paths: tracingPaths,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.settings.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      setUpstreamUrl("")
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-8 flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your proxy settings</p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-2 mb-6 flex-shrink-0">
        <Button
          variant="outline"
          onClick={() => {
            deleteMutation.mutate()
            setTracingPaths(["/v1/chat/completions"])
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !upstreamUrl}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      {saveMutation.isError && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          Failed to save settings. Please try again.
        </div>
      )}

      {saveMutation.isSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
          Settings saved successfully!
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 flex-shrink-0">
        {/* Upstream URL Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upstream URL</CardTitle>
            <CardDescription>
              The base URL of the LLM provider to forward requests to.
              All requests will be proxied to this endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="https://api.openai.com/v1"
              value={upstreamUrl}
              onChange={(e) => setUpstreamUrl(e.target.value)}
            />
            {settings?.upstream_url && (
              <div className="text-sm text-muted-foreground">
                Current: <code className="bg-muted px-2 py-1 rounded">{settings.upstream_url}</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracing Paths Card */}
        <Card>
          <CardHeader>
            <CardTitle>Tracing Paths</CardTitle>
            <CardDescription>
              API paths that should appear in the Tracings tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="/v1/chat/completions"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPath) {
                    setTracingPaths([...tracingPaths, newPath])
                    setNewPath("")
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (newPath && !tracingPaths.includes(newPath)) {
                    setTracingPaths([...tracingPaths, newPath])
                    setNewPath("")
                  }
                }}
                disabled={!newPath}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-auto">
              {tracingPaths.map((path, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                  <code className="text-sm">{path}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setTracingPaths(tracingPaths.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {tracingPaths.length === 0 && (
                <p className="text-sm text-muted-foreground">No tracing paths configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-2xl mt-6 flex-shrink-0">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. Set the upstream URL to your LLM provider endpoint (e.g., <code className="bg-muted px-1 rounded">https://api.openai.com/v1</code>)
          </p>
          <p>
            2. Make requests to this proxy at <code className="bg-muted px-1 rounded">http://localhost:3535</code> instead
          </p>
          <p>
            3. All requests and responses will be logged for debugging and analysis
          </p>
          <p>
            4. View the logs in the <a href="/logs" className="text-primary hover:underline">Logs</a> page
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
