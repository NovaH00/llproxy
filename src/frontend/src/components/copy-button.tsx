import { useState } from "react"
import { Button } from "./ui/button"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CopyButtonProps {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({
        title: "Copied to clipboard",
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy!", err)
      toast({
        title: "Failed to copy",
        variant: "destructive",
      })
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={copy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )
}
