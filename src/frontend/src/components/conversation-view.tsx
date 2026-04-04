import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { LogEntry, ToolDefinition } from "@/types"
import { Settings, User, Bot, Brain, Eye, ChevronDown, ChevronUp, ChevronRight, Wrench, WrenchIcon, FunctionSquare } from "lucide-react"
import type { ToolCall } from "@/types"

// Reuse schema field rendering from ResponseFormatCard
interface ToolSchemaFieldProps {
  name: string
  schema: any
  required?: string[]
  depth?: number
  defs?: Record<string, any>
}

function ToolSchemaField({ name, schema, required = [], depth = 0, defs = {} }: ToolSchemaFieldProps) {
  const [isOpen, setIsOpen] = useState(depth < 1)

  const isRequired = required.includes(name)

  const resolvedSchema = schema.$ref
    ? resolveToolRef(schema.$ref, defs) || schema
    : schema

  const hasChildren = resolvedSchema.properties ||
    (resolvedSchema.type === 'array' && (
      resolvedSchema.items?.properties ||
      (resolvedSchema.items?.$ref && resolveToolRef(resolvedSchema.items.$ref, defs))
    ))

  const description = resolvedSchema.description

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: 'text-green-600 dark:text-green-400',
      number: 'text-blue-600 dark:text-blue-400',
      integer: 'text-blue-600 dark:text-blue-400',
      boolean: 'text-purple-600 dark:text-purple-400',
      array: 'text-orange-600 dark:text-orange-400',
      object: 'text-red-600 dark:text-red-400',
    }
    return colors[type] || 'text-muted-foreground'
  }

  const formatType = (s: any): string => {
    if (s.type === 'array') {
      if (s.items?.$ref) {
        const refName = s.items.$ref.split('/').pop()
        return `Array<${refName}>`
      }
      const itemsType = s.items?.type || 'any'
      return `Array<${itemsType}>`
    }
    if (s.enum) {
      return s.enum.map((v: any) => JSON.stringify(v)).join(' | ')
    }
    return s.type || 'any'
  }

  const indent = depth * 16
  const displayName = schema.$ref ? schema.$ref.split('/').pop() || name : name

  return (
    <div className="py-0.5">
      <div
        className="flex items-center gap-1 hover:bg-muted/50 rounded px-2 py-0.5 cursor-pointer transition-colors"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 p-0" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}
        <span className="font-mono text-sm font-medium">{displayName}</span>
        {isRequired && <Badge variant="destructive" className="h-4 text-[9px] px-1 scale-90 origin-left">required</Badge>}
        <span className={`font-mono text-sm ${getTypeColor(resolvedSchema.type)}`}>: {formatType(resolvedSchema)}</span>
      </div>
      {description && (
        <div className="text-xs text-muted-foreground italic ml-6 mr-2" style={{ paddingLeft: `${indent}px` }}>{description}</div>
      )}
      {isOpen && hasChildren && (
        <div>
          {resolvedSchema.type === 'array' && resolvedSchema.items?.$ref && (() => {
            const refSchema = resolveToolRef(resolvedSchema.items.$ref, defs)
            if (refSchema?.properties) {
              return Object.entries(refSchema.properties).map(([childName, childSchema]) => (
                <ToolSchemaField key={childName} name={childName} schema={childSchema as any} required={refSchema.required || []} depth={depth + 1} defs={defs} />
              ))
            }
            return null
          })()}
          {resolvedSchema.type === 'array' && resolvedSchema.items?.properties && !resolvedSchema.items?.$ref &&
            Object.entries(resolvedSchema.items.properties).map(([childName, childSchema]) => (
              <ToolSchemaField key={childName} name={childName} schema={childSchema as any} required={resolvedSchema.items.required || []} depth={depth + 1} defs={defs} />
            ))
          }
          {resolvedSchema.properties &&
            Object.entries(resolvedSchema.properties).map(([childName, childSchema]) => (
              <ToolSchemaField key={childName} name={childName} schema={childSchema as any} required={resolvedSchema.required || []} depth={depth + 1} defs={defs} />
            ))
          }
        </div>
      )}
    </div>
  )
}

function resolveToolRef(ref: string, defs: Record<string, any>) {
  if (ref.startsWith('#/$defs/')) {
    const defName = ref.split('/').pop()
    return defs[defName || '']
  }
  if (ref.startsWith('#/definitions/')) {
    const defName = ref.split('/').pop()
    return defs[defName || '']
  }
  return null
}

interface Message {
  role: string
  content: string | null
  reasoning_content?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCallViewProps {
  toolCall: ToolCall
}

function ToolCallView({ toolCall }: ToolCallViewProps) {
  const [isOpen, setIsOpen] = useState(true)
  
  let parsedArgs: Record<string, unknown> = {}
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments)
  } catch {
    parsedArgs = { raw: toolCall.function.arguments }
  }

  const toolCallId = toolCall.id || "unknown"

  return (
    <div className="border rounded-md bg-secondary/50 border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{toolCall.function.name}</span>
          <span className="text-xs text-muted-foreground font-mono">{toolCallId.slice(0, 8)}...</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
      </div>

      {isOpen && (
        <div className="p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Arguments:</div>
          <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-64 text-foreground">
            {JSON.stringify(parsedArgs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

interface ToolResultViewProps {
  content: string
}

function ToolResultView({ content }: ToolResultViewProps) {
  // Try to parse content as JSON for nicer display
  let parsedContent: unknown
  let isJson = false
  try {
    parsedContent = JSON.parse(content)
    isJson = true
  } catch {
    parsedContent = content
  }

  return (
    <div className="space-y-2">
      {isJson ? (
        <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-96 font-mono text-foreground">
          {JSON.stringify(parsedContent, null, 2)}
        </pre>
      ) : (
        <div className="text-sm whitespace-pre-wrap font-mono bg-background border rounded-md p-2 overflow-auto max-h-96 text-foreground">
          {content}
        </div>
      )}
    </div>
  )
}

interface ToolsListViewProps {
  tools: ToolDefinition[]
}

interface ToolItemProps {
  tool: ToolDefinition
}

function ToolItem({ tool }: ToolItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const schema = tool.function.parameters
  const defs = schema?.$defs || schema?.definitions || {}
  const schemaWithoutDefs: Record<string, unknown> | undefined = schema
    ? Object.fromEntries(Object.entries(schema).filter(([k]) => k !== '$defs' && k !== 'definitions'))
    : undefined

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <FunctionSquare className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
          <span className="text-sm font-semibold text-foreground">{tool.function.name}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="px-4 pb-3">
          {tool.function.description && (
            <div className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{tool.function.description}</div>
          )}
          {schemaWithoutDefs && (schemaWithoutDefs as any).properties && (
            <div className="border rounded-md bg-background">
              <div className="px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameters</span>
              </div>
              <div className="p-2">
                {Object.entries((schemaWithoutDefs as any).properties).map(([propName, propSchema]) => (
                  <ToolSchemaField
                    key={propName}
                    name={propName}
                    schema={propSchema}
                    required={(schemaWithoutDefs as any).required || []}
                    depth={0}
                    defs={defs}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolsListView({ tools }: ToolsListViewProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <WrenchIcon className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          <span className="text-base font-semibold text-foreground">Available tools</span>
          <Badge variant="secondary" className="text-xs">{tools.length}</Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="divide-y">
          {tools.map((tool: ToolDefinition, idx: number) => (
            <ToolItem key={idx} tool={tool} />
          ))}
        </div>
      )}
    </div>
  )
}

interface ConversationViewProps {
  log: LogEntry
}

export function ConversationView({ log }: ConversationViewProps) {
  const messages = log.request_body?.messages || []

  // Helper to extract text from content (string or array of content blocks)
  const extractText = (content: string | unknown[] | null | undefined): string => {
    if (!content) return ""
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .map((block: any) => block?.text || block?.content || "")
        .filter(Boolean)
        .join("\n")
    }
    return String(content)
  }

  // Extract assistant message and reasoning from response
  let assistantContent: string | null = null
  let reasoningContent: string | null = null
  let assistantToolCalls: ToolCall[] = []

  if (log.response_body?.choices?.[0]?.message) {
    const msg = log.response_body.choices[0].message
    assistantContent = extractText(msg.content as string | unknown[] | null | undefined) || null
    if ((msg as any).reasoning_content) {
      reasoningContent = (msg as any).reasoning_content
    }
    if ((msg as any).tool_calls) {
      assistantToolCalls = (msg as any).tool_calls
    }
  }

  if (log.response_body_raw) {
    const lines = log.response_body_raw.split("\n")
    let content = ""
    let reasoning = ""
    // Map to accumulate tool calls by index
    const toolCallsMap = new Map<number, ToolCall>()

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
          // Accumulate tool calls from streaming chunks
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index
              const existing = toolCallsMap.get(index)
              
              if (!existing) {
                // First chunk for this tool call
                toolCallsMap.set(index, {
                  id: tc.id || "",
                  type: tc.type || "function",
                  function: {
                    name: tc.function?.name || "",
                    arguments: tc.function?.arguments || ""
                  }
                })
              } else {
                // Subsequent chunk - accumulate function data
                if (tc.function?.name) {
                  existing.function.name += tc.function.name
                }
                if (tc.function?.arguments) {
                  existing.function.arguments += tc.function.arguments
                }
              }
            }
          }
          if (chunk.choices?.[0]?.message) {
            const fullMsg = chunk.choices[0].message
            if (fullMsg.content && !assistantContent) {
              assistantContent = fullMsg.content
            }
            if ((fullMsg as any).reasoning_content && !reasoningContent) {
              reasoningContent = (fullMsg as any).reasoning_content
            }
            // Handle non-streaming tool calls (all in one message)
            if ((fullMsg as any).tool_calls && assistantToolCalls.length === 0) {
              assistantToolCalls = (fullMsg as any).tool_calls
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
    // Convert map to array, only if not already set from non-streaming
    if (assistantToolCalls.length === 0 && toolCallsMap.size > 0) {
      assistantToolCalls = Array.from(toolCallsMap.values())
    }
  }

  const allMessages: Message[] = [
    ...messages.map(m => ({
      role: m.role,
      content: extractText(m.content),
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id
    })),
    ...(assistantContent || reasoningContent || assistantToolCalls.length > 0 ? [{
      role: "assistant",
      content: assistantContent,
      reasoning_content: reasoningContent,
      tool_calls: assistantToolCalls.length > 0 ? assistantToolCalls : undefined
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
        return "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400"
      case "user":
        return "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400"
      case "assistant":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
      case "tool":
        return "bg-gray-500/15 border-gray-500/40 text-gray-700 dark:text-gray-400"
      default:
        return "bg-muted border-border"
    }
  }

  const getRoleIcon = (role: string) => {
    const iconClass = "h-4 w-4"
    switch (role) {
      case "system":
        return <Settings className={`${iconClass} text-amber-600 dark:text-amber-400`} />
      case "user":
        return <User className={`${iconClass} text-blue-600 dark:text-blue-400`} />
      case "assistant":
        return <Bot className={`${iconClass} text-emerald-600 dark:text-emerald-400`} />
      case "tool":
        return <Wrench className={`${iconClass} text-gray-600 dark:text-gray-400`} />
      default:
        return <Bot className={`${iconClass} text-foreground`} />
    }
  }

  const getRoleLabel = (role: string) => {
    if (role === "assistant" && log.model) {
      return log.model.split("/").pop()?.split(":")[0] || "assistant"
    }
    return role
  }

  // Build a map of tool_call_id -> tool name for tool messages
  const toolCallIdToName = new Map<string, string>()
  allMessages.forEach(msg => {
    if (msg.tool_calls) {
      msg.tool_calls.forEach(tc => {
        if (tc.id) {
          toolCallIdToName.set(tc.id, tc.function.name)
        }
      })
    }
  })

  const getToolName = (toolCallId: string | undefined): string => {
    if (!toolCallId) return "unknown"
    return toolCallIdToName.get(toolCallId) || "unknown"
  }

  const renderMessageContent = (msg: Message) => {
    // Assistant with tool calls
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      return (
        <div className="space-y-3">
          {msg.tool_calls.map((toolCall, tcIdx) => (
            <ToolCallView key={toolCall.id || tcIdx} toolCall={toolCall} />
          ))}
        </div>
      )
    }
    
    // Tool result message
    if (msg.role === "tool" && msg.tool_call_id) {
      return (
        <ToolResultView
          content={msg.content || ""}
        />
      )
    }
    
    // Regular message content
    return (
      <div className="text-sm whitespace-pre-wrap font-mono break-words">
        {msg.content || <span className="text-muted-foreground italic">[no content]</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-medium text-muted-foreground">Total messages: {allMessages.length}</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
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
        {log.request_body?.tools && log.request_body.tools.length > 0 && (
          <ToolsListView tools={log.request_body.tools} />
        )}
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
                  <span>
                    {getRoleIcon(msg.role)}
                  </span>
                  <Badge variant="outline" className={`text-sm border-current ${
                    msg.role === 'system' ? 'text-amber-600 dark:text-amber-400 border-amber-500/50' :
                    msg.role === 'user' ? 'text-blue-600 dark:text-blue-400 border-blue-500/50' :
                    msg.role === 'assistant' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/50' :
                    msg.role === 'tool' ? 'text-gray-600 dark:text-gray-400 border-gray-500/50' :
                    'text-foreground'
                  }`}>
                    {msg.role === "tool" ? `Tool Output: ${getToolName(msg.tool_call_id)}` : getRoleLabel(msg.role)}
                  </Badge>
                  {msg.role === "tool" && msg.tool_call_id && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {msg.tool_call_id.slice(0, 8)}...
                    </Badge>
                  )}
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
                  {msg.role !== "tool" && (
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
                  )}
                </div>
              </div>

              {isVisible && (
                <>
                  {/* Reasoning content (if available) */}
                  {hasReasoning && isReasoningVisible && (
                    <div className="mb-3 p-3 rounded-md bg-violet-500/10 border border-violet-500/20">
                      <div className="flex items-center gap-2 mb-2 text-violet-700 dark:text-violet-400">
                        <Brain className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Reasoning</span>
                      </div>
                      <div className="text-xs whitespace-pre-wrap font-mono text-violet-700 dark:text-violet-300">
                        {msg.reasoning_content}
                      </div>
                    </div>
                  )}

                  {/* Message content */}
                  {renderMessageContent(msg)}
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
