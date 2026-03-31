import { Sidebar } from "./sidebar"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64">
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
