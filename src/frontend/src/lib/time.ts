export function formatTime(dateStr: string | null): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return ""
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) {
    return diffSec <= 1 ? "just now" : `${diffSec} seconds ago`
  }
  if (diffMin < 60) {
    return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`
  }
  if (diffHour < 24) {
    return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`
  }
  if (diffDay < 7) {
    return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`
  }
  return ""
}
