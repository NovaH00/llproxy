import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Layout } from "@/components/layout/layout"
import { Dashboard } from "@/pages/dashboard"
import { Tracings } from "@/pages/tracings"
import { Logs } from "@/pages/logs"
import { Settings } from "@/pages/settings"
import { Toaster } from "@/components/ui/toaster"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tracings" element={<Tracings />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
