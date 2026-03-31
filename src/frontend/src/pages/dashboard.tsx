import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollText, Clock, GitBranch } from "lucide-react"

export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.logs.getStats(),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  const statCards = [
    {
      title: "Total Requests",
      value: stats?.total_requests ?? 0,
      icon: ScrollText,
      description: "All time requests",
    },
    {
      title: "Streaming Requests",
      value: stats?.streaming_requests ?? 0,
      icon: GitBranch,
      description: "Requests with streaming",
    },
    {
      title: "Non-Streaming Requests",
      value: stats?.non_streaming_requests ?? 0,
      icon: ScrollText,
      description: "Regular requests",
    },
    {
      title: "Avg Latency",
      value: stats?.avg_latency_ms ? `${Math.round(stats.avg_latency_ms)}ms` : "N/A",
      icon: Clock,
      description: "Average response time",
    },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-8 flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your proxy usage</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
