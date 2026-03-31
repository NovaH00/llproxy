import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { LogEntry } from "@/types"
import { Settings, User, Bot, Brain, Eye, ChevronDown, ChevronUp } from "lucide-react"

interface ConversationViewProps {
  log: LogEntry
}

interface Message {
  role: string
  content: string | null
  reasoning_content?: string | null
}

export function ConversationView({ log }: ConversationViewProps) {
  const messages = log.request_body?.messages || []
  
  // Extract assistant message and reasoning from response
  let assistantContent: string | null = null
  let reasoningContent: string | null = null
  
  if (log.response_body?.choices?.[0]?.message) {
    const msg = log.response_body.choices[0].message
    assistantContent = msg.content || null
    if ((msg as any).reasoning_content) {
      reasoningContent = (msg as any).reasoning_content
    }
  }
  
  if (log.response_body_raw) {
    const lines = log.response_body_raw.split("\n")
    let content = ""
    let reasoning = ""
    
    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const chunk = JSON.parse(line.slice(6))
          const delta = chunk.choices?.[0]?.delta
          
          if (delta?.reasoning_content) {
            reasoning += delta.reasoning_content
          }
          if (delta?.content) {
            content += delta.content
          }
          if (chunk.choices?.[0]?.message) {
            const fullMsg = chunk.choices[0].message
            if (fullMsg.content && !assistantContent) {
              assistantContent = fullMsg.content
            }
            if ((fullMsg as any).reasoning_content && !reasoningContent) {
              reasoningContent = (fullMsg as any).reasoning_content
            }
          }
        } catch {
          continue
        }
      }
    }
    
    if (!assistantContent && content) {
      assistantContent = content
    }
    if (!reasoningContent && reasoning) {
      reasoningContent = reasoning
    }
  }

  const allMessages: Message[] = [
    ...messages.map(m => ({ role: m.role, content: m.content })),
    ...(assistantContent || reasoningContent ? [{ 
      role: "assistant", 
      content: assistantContent,
      reasoning_content: reasoningContent
    }] : [])
  ]

  // Track visibility for each message
  const [visibleMessages, setVisibleMessages] = useState<Record<number, boolean>>(
    () => Object.fromEntries(allMessages.map((_, idx) => [idx, true]))
  )
  
  // Track reasoning visibility separately for assistant messages
  const [visibleReasoning, setVisibleReasoning] = useState<Record<number, boolean>>(
    () => Object.fromEntries(
      allMessages.map((_, idx) => [idx, true])
    )
  )

  const toggleMessage = (idx: number) => {
    setVisibleMessages(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const toggleReasoning = (idx: number) => {
    setVisibleReasoning(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const getRoleStyles = (role: string) => {
    switch (role) {
      case "system":
        return "bg-orange-50 border-orange-200 text-orange-900"
      case "user":
        return "bg-blue-50 border-blue-200 text-blue-900"
      case "assistant":
        return "bg-green-50 border-green-200 text-green-900"
      default:
        return "bg-muted border-border"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "system":
        return <Settings className="h-4 w-4" />
      case "user":
        return <User className="h-4 w-4" />
      case "assistant":
        return <Bot className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  const getRoleLabel = (role: string) => {
    if (role === "assistant" && log.model) {
      return log.model.split("/").pop()?.split(":")[0] || "Assistant"
    }
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-medium text-muted-foreground">Conversation</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              // Show all messages
              const newVisibility: Record<number, boolean> = {}
              allMessages.forEach((_, idx) => {
                newVisibility[idx] = true
              })
              setVisibleMessages(newVisibility)
              setVisibleReasoning(newVisibility)
            }}
            disabled={Object.values(visibleMessages).every(v => v !== false)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Show All
          </Button>
        </div>
      </div>
      <div className="space-y-3 overflow-auto flex-1 pr-2">
        {allMessages.map((msg, idx) => {
          const isVisible = visibleMessages[idx] !== false
          const hasReasoning = msg.reasoning_content
          const isReasoningVisible = visibleReasoning[idx] !== false
          
          return (
            <div
              key={idx}
              className={`rounded-lg border p-4 ${getRoleStyles(msg.role)} ${!isVisible ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/70">
                    {getRoleIcon(msg.role)}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {getRoleLabel(msg.role)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {hasReasoning && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleReasoning(idx)
                      }}
                    >
                      {isReasoningVisible ? (
                        <Brain className="h-3.5 w-3.5" />
                      ) : (
                        <Brain className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMessage(idx)
                    }}
                  >
                    {isVisible ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              
              {isVisible && (
                <>
                  {/* Reasoning content (if available) */}
                  {hasReasoning && isReasoningVisible && (
                    <div className="mb-3 p-3 rounded-md bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-2 mb-2 text-purple-700">
                        <Brain className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Reasoning</span>
                      </div>
                      <div className="text-xs whitespace-pre-wrap font-mono text-purple-900">
                        {msg.reasoning_content}
                      </div>
                    </div>
                  )}
                  
                  {/* Regular content */}
                  <div className="text-sm whitespace-pre-wrap font-mono break-words">
                    {msg.content || <span className="text-muted-foreground italic">[no content]</span>}
                  </div>
                </>
              )}
              
              {!isVisible && (
                <div className="text-xs text-muted-foreground italic">
                  Message hidden
                </div>
              )}
            </div>
          )
        })}
        {allMessages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No conversation messages
          </div>
        )}
      </div>
    </div>
  )
}
