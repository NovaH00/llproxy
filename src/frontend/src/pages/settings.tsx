import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Settings as SettingsType } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Save, RotateCcw, Plus, X, Sun, Moon, Monitor, Globe, Route } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ToastProvider, ToastViewport } from "@/components/ui/toast"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

type SettingSection = "upstream" | "tracing" | "theme"

interface NavItem {
  id: SettingSection
  label: string
  icon: React.ReactNode
  description: string
}

const navItems: NavItem[] = [
  {
    id: "upstream",
    label: "Upstream URL",
    icon: <Globe className="h-4 w-4" />,
    description: "Configure the LLM provider endpoint",
  },
  {
    id: "tracing",
    label: "Tracing Paths",
    icon: <Route className="h-4 w-4" />,
    description: "API paths to track in Tracings tab",
  },
  {
    id: "theme",
    label: "Appearance",
    icon: <Sun className="h-4 w-4" />,
    description: "Customize the dashboard theme",
  },
]

export function Settings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { setTheme } = useTheme()
  const [activeSection, setActiveSection] = useState<SettingSection>("upstream")
  
  // Upstream URL state
  const [upstreamUrl, setUpstreamUrl] = useState<string>("")
  const [savedUpstreamUrl, setSavedUpstreamUrl] = useState<string>("")
  
  // Tracing paths state (staged changes)
  const [tracingPaths, setTracingPaths] = useState<string[]>(["/v1/chat/completions"])
  const [savedTracingPaths, setSavedTracingPaths] = useState<string[]>(["/v1/chat/completions"])
  const [newPath, setNewPath] = useState("")
  
  // Theme state (localStorage only, no staging needed)
  const [theme, setThemeState] = useState<string>(() => {
    return localStorage.getItem("theme") || "system"
  })

  const { data: settings, isLoading } = useQuery<SettingsType>({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
  })

  useEffect(() => {
    if (settings?.upstream_url) {
      setUpstreamUrl(settings.upstream_url)
      setSavedUpstreamUrl(settings.upstream_url)
    }
    if (settings?.tracing_paths) {
      setTracingPaths(settings.tracing_paths)
      setSavedTracingPaths(settings.tracing_paths)
    }
  }, [settings])

  const hasUpstreamChanges = upstreamUrl !== savedUpstreamUrl
  const hasTracingChanges = JSON.stringify(tracingPaths) !== JSON.stringify(savedTracingPaths)

  const saveUpstreamMutation = useMutation({
    mutationFn: () => api.settings.set({
      upstream_url: upstreamUrl,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      setSavedUpstreamUrl(upstreamUrl)
      toast({
        title: "Upstream URL saved",
        description: "The provider endpoint has been updated.",
      })
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save upstream URL. Please try again.",
        variant: "destructive",
      })
    },
  })

  const saveTracingMutation = useMutation({
    mutationFn: () => api.settings.set({
      tracing_paths: tracingPaths,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      setSavedTracingPaths([...tracingPaths])
      toast({
        title: "Tracing paths saved",
        description: "The tracing paths have been updated.",
      })
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save tracing paths. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleDiscardUpstream = () => {
    setUpstreamUrl(savedUpstreamUrl)
  }

  const handleDiscardTracing = () => {
    setTracingPaths([...savedTracingPaths])
  }

  const handleThemeChange = useCallback((value: string) => {
    setThemeState(value)
    setTheme(value)
    localStorage.setItem("theme", value)
    toast({
      title: "Theme updated",
      description: `Theme changed to ${value}.`,
    })
  }, [setTheme, toast])

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <ToastProvider>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your proxy configuration</p>
        </div>

        <div className="flex gap-8 flex-1 min-h-0">
          {/* Left Navigation Panel */}
          <nav className="w-72 flex-shrink-0 overflow-y-auto pr-4 border-r">
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors",
                    activeSection === item.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="mt-0.5">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </nav>

          {/* Right Content Panel */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <div className="max-w-3xl pb-8">
              {/* Upstream URL Section */}
              {activeSection === "upstream" && (
                <div className="space-y-6">
                  {/* Setting Header */}
                  <div>
                    <h2 className="text-xl font-semibold">Upstream URL</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                      The base URL of the LLM provider to forward requests to. All requests will be proxied to this endpoint.
                    </p>
                  </div>

                  {/* Setting Control */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Provider endpoint</label>
                    <div className="max-w-lg px-1">
                      <Input
                        placeholder="https://api.openai.com/v1"
                        value={upstreamUrl}
                        onChange={(e) => setUpstreamUrl(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Additional Context */}
                  {savedUpstreamUrl && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3 max-w-lg">
                      <Globe className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">Currently configured:</span>{" "}
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{savedUpstreamUrl}</code>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => saveUpstreamMutation.mutate()}
                      disabled={saveUpstreamMutation.isPending || !hasUpstreamChanges}
                      size="sm"
                    >
                      {saveUpstreamMutation.isPending ? (
                        <span className="animate-spin mr-2">⟳</span>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDiscardUpstream}
                      disabled={!hasUpstreamChanges}
                      size="sm"
                    >
                      Discard
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setUpstreamUrl("")}
                      disabled={!savedUpstreamUrl && !upstreamUrl}
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                    {hasUpstreamChanges && (
                      <span className="text-xs text-muted-foreground ml-2">Unsaved changes</span>
                    )}
                  </div>

                  {/* Help / Additional Info */}
                  <div className="border-t pt-6 mt-8">
                    <h3 className="text-sm font-medium mb-3">About upstream URLs</h3>
                    <div className="text-sm text-muted-foreground space-y-3 max-w-xl">
                      <p>
                        The upstream URL should point to the base endpoint of your LLM provider.
                        The path from incoming requests (e.g., <code className="bg-muted px-1 rounded">/v1/chat/completions</code>) will be appended automatically.
                      </p>
                      <div>
                        <p className="font-medium text-foreground mb-2">Examples:</p>
                        <ul className="space-y-1.5 ml-4 list-disc">
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://api.openai.com/v1</code></li>
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">http://localhost:6969</code></li>
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://your-custom-provider.com/v1</code></li>
                        </ul>
                      </div>
                      <p className="text-xs">
                        <strong>Note:</strong> Do not include the API path in the upstream URL. Only provide the base URL.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tracing Paths Section */}
              {activeSection === "tracing" && (
                <div className="space-y-6">
                  {/* Setting Header */}
                  <div>
                    <h2 className="text-xl font-semibold">Tracing Paths</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                      API paths that should appear in the Tracings tab. Only requests matching these paths will be shown for detailed analysis.
                    </p>
                  </div>

                  {/* Setting Control */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Add a path</label>
                    <div className="flex gap-2 max-w-lg ml-1">
                      <Input
                        placeholder="/v1/chat/completions"
                        value={newPath}
                        onChange={(e) => setNewPath(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newPath) {
                            if (!tracingPaths.includes(newPath)) {
                              setTracingPaths([...tracingPaths, newPath])
                            }
                            setNewPath("")
                          }
                        }}
                        className="font-mono text-sm flex-1"
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
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Configured Paths List */}
                  <div className="space-y-2 max-w-lg">
                    <label className="text-sm font-medium">Configured paths</label>
                    <div className="border rounded-md divide-y">
                      {tracingPaths.map((path, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2.5 first:rounded-t-md last:rounded-b-md">
                          <code className="text-sm font-mono">{path}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setTracingPaths(tracingPaths.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {tracingPaths.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No tracing paths configured</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => saveTracingMutation.mutate()}
                      disabled={saveTracingMutation.isPending || !hasTracingChanges}
                      size="sm"
                    >
                      {saveTracingMutation.isPending ? (
                        <span className="animate-spin mr-2">⟳</span>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDiscardTracing}
                      disabled={!hasTracingChanges}
                      size="sm"
                    >
                      Discard
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setTracingPaths(["/v1/chat/completions"])}
                      disabled={tracingPaths.length === 1 && tracingPaths[0] === "/v1/chat/completions"}
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset to default
                    </Button>
                    {hasTracingChanges && (
                      <span className="text-xs text-muted-foreground ml-2">Unsaved changes</span>
                    )}
                  </div>

                  {/* Help / Additional Info */}
                  <div className="border-t pt-6 mt-8">
                    <h3 className="text-sm font-medium mb-3">About tracing paths</h3>
                    <div className="text-sm text-muted-foreground space-y-3 max-w-xl">
                      <p>
                        Tracing paths filter which API endpoints appear in the Tracings tab.
                        This helps you focus on the most relevant requests for debugging and analysis.
                      </p>
                      <div>
                        <p className="font-medium text-foreground mb-2">Common paths:</p>
                        <ul className="space-y-1.5 ml-4 list-disc">
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">/v1/chat/completions</code> - Chat completions</li>
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">/v1/completions</code> - Legacy completions</li>
                          <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">/v1/embeddings</code> - Embeddings</li>
                        </ul>
                      </div>
                      <p className="text-xs">
                        <strong>Tip:</strong> Press Enter or click Add to add a new path. Click the X button to remove a path.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Theme Section */}
              {activeSection === "theme" && (
                <div className="space-y-6">
                  {/* Setting Header */}
                  <div>
                    <h2 className="text-xl font-semibold">Appearance</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                      Choose the appearance of the dashboard interface. The theme affects all pages and components.
                    </p>
                  </div>

                  {/* Setting Control */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Theme preference</label>
                    <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid grid-cols-3 gap-4 max-w-md">
                      <div>
                        <RadioGroupItem value="light" id="light" className="peer sr-only" />
                        <Label
                          htmlFor="light"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Sun className="mb-3 h-6 w-6" />
                          Light
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                        <Label
                          htmlFor="dark"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Moon className="mb-3 h-6 w-6" />
                          Dark
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="system" id="system" className="peer sr-only" />
                        <Label
                          htmlFor="system"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Monitor className="mb-3 h-6 w-6" />
                          System
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Help / Additional Info */}
                  <div className="border-t pt-6 mt-8">
                    <h3 className="text-sm font-medium mb-3">About themes</h3>
                    <div className="text-sm text-muted-foreground space-y-3 max-w-xl">
                      <ul className="space-y-2 ml-4 list-disc">
                        <li>
                          <strong className="text-foreground">Light</strong> - Always use the light theme regardless of system settings.
                        </li>
                        <li>
                          <strong className="text-foreground">Dark</strong> - Always use the dark theme regardless of system settings.
                        </li>
                        <li>
                          <strong className="text-foreground">System</strong> - Automatically match your operating system's theme preference (default).
                        </li>
                      </ul>
                      <p className="text-xs">
                        The theme preference is saved to your browser's local storage and persists across sessions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <ToastViewport />
      </div>
    </ToastProvider>
  )
}
