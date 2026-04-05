import type { LogEntry } from "@/types"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

interface MetadataViewProps {
  log: LogEntry
}

interface Timings {
  cache_n?: number
  prompt_n?: number
  prompt_ms?: number
  prompt_per_token_ms?: number
  prompt_per_second?: number
  predicted_n?: number
  predicted_ms?: number
  predicted_per_token_ms?: number
  predicted_per_second?: number
}

interface StatWithExplanation {
  label: string
  value: React.ReactNode
  detailValue?: React.ReactNode
  explanation: React.ReactNode
}

function StatItem({ stat }: { stat: StatWithExplanation }) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-help group">
          <div className="text-base text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</div>
          <div className="font-semibold text-base">
            {stat.detailValue ? (
              <div className="grid grid-cols-1 grid-rows-1">
                <div className="col-start-1 row-start-1 transition-opacity duration-200 ease-in-out group-hover:opacity-0">
                  {stat.value}
                </div>
                <div className="col-start-1 row-start-1 opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100">
                  {stat.detailValue}
                </div>
              </div>
            ) : (
              stat.value
            )}
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-96">
        <div className="text-lg">{stat.explanation}</div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function MetadataView({ log }: MetadataViewProps) {
  // Extract timings from the last chunk of response
  let timings: Timings | null = null

  if (log.response_body_raw) {
    const lines = log.response_body_raw.split("\n")
    for (const line of lines.reverse()) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const chunk = JSON.parse(line.slice(6))
          if (chunk.timings) {
            timings = chunk.timings
            break
          }
        } catch {
          continue
        }
      }
    }
  }

  // Also check parsed response body
  if (!timings && log.response_body) {
    const raw = log.response_body as unknown as { timings?: Timings }
    timings = raw.timings || null
  }

  const inputTokens = timings?.prompt_n || 0
  const cacheHits = timings?.cache_n || 0
  const outputTokens = timings?.predicted_n || 0
  const totalInputTokens = inputTokens + cacheHits
  const computedTokens = inputTokens + outputTokens

  // Extract generation parameters
  const reqBody = log.request_body
  const temperature = reqBody?.temperature
  const topP = reqBody?.top_p
  const maxTokens = reqBody?.max_tokens
  const frequencyPenalty = reqBody?.frequency_penalty
  const presencePenalty = reqBody?.presence_penalty

  // Extract finish reason from response body or raw stream
  let finishReason: string | null = log.response_body?.choices?.[0]?.finish_reason || null

  if (!finishReason && log.response_body_raw) {
    const lines = log.response_body_raw.split("\n")
    for (const line of lines.reverse()) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const chunk = JSON.parse(line.slice(6))
          if (chunk.choices?.[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason
            break
          }
        } catch {
          continue
        }
      }
    }
  }

  const performanceStats: StatWithExplanation[] = [
    {
      label: "Token Computation",
      value: (
        <span>
          <span className="text-blue-500 dark:text-blue-400">{inputTokens.toLocaleString()}</span>
          {" + "}
          <span className="text-green-500 dark:text-green-400">{outputTokens.toLocaleString()}</span>
          {" = "}
          <span className="text-cyan-500 dark:text-cyan-400">{computedTokens.toLocaleString()}</span>
        </span>
      ),
      detailValue: cacheHits > 0 ? (
        <span>
          <span className="text-pink-500 dark:text-pink-400">{totalInputTokens.toLocaleString()}</span>
          {" − "}
          <span className="text-amber-500 dark:text-amber-400">{cacheHits.toLocaleString()}</span>
          {" + "}
          <span className="text-green-500 dark:text-green-400">{outputTokens.toLocaleString()}</span>
          {" = "}
          <span className="text-cyan-500 dark:text-cyan-400">{computedTokens.toLocaleString()}</span>
        </span>
      ) : undefined,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Token Computation Breakdown</p>
          <div className="space-y-1 text-base text-muted-foreground">
            { cacheHits > 0 && <p>
                <span className="text-pink-500 dark:text-pink-400 font-medium">Total prompt: {totalInputTokens.toLocaleString()} </span>
                total tokens in the prompt
              </p>
            }
            <p>
              <span className="text-amber-500 dark:text-amber-400 font-medium">
              Cache hits: {cacheHits.toLocaleString()}</span> tokens served from cache without recomputing
            </p>
            <p>
              <span className="text-blue-500 dark:text-blue-400 font-medium">Input tokens: </span> 
              <span className="text-pink-500 dark:text-pink-400">{totalInputTokens.toLocaleString()}</span>
              <span className="text-xl text-foreground"> - </span>
              <span className="text-amber-500 dark:text-amber-400">{cacheHits.toLocaleString()}</span>
              <span className="text-xl text-foreground"> = </span>
              <span className="text-blue-500 dark:text-blue-400 font-medium">{inputTokens.toLocaleString()} </span> 
              tokens the model actually compute (after cache deduction)
            </p>
            <p>
              <span className="text-green-500 dark:text-green-400 font-medium">Output tokens: {outputTokens.toLocaleString()} </span> 
              tokens generated by the model
            </p>
            <p>
              <span className="text-cyan-500 dark:text-cyan-400 font-medium">Computed total: </span>
              <span className="text-blue-500 dark:text-blue-400 font-medium">{inputTokens.toLocaleString()} </span> 
              <span className="text-xl text-foreground"> + </span>
              <span className="text-green-500 dark:text-green-400">{outputTokens.toLocaleString()}</span>
              <span className="text-xl text-foreground"> = </span>
              <span className="text-cyan-500 dark:text-cyan-400 font-medium">{computedTokens.toLocaleString()} </span>
              tokens actually processed 
            </p>
          </div>
        </div>
      ),
    },
    {
      label: "Processing Speed",
      value: timings?.prompt_per_second || timings?.predicted_per_second ? (
        <span>
          <span className="text-blue-500 dark:text-blue-400">
            {timings?.prompt_per_second ? `${timings.prompt_per_second.toFixed(2)}` : "—"}
          </span>
          {" | "}
          <span className="text-green-500 dark:text-green-400">
            {timings?.predicted_per_second ? `${timings.predicted_per_second.toFixed(2)}` : "—"}
          </span>
        </span>
      ) : "N/A",
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Processing Speed Breakdown</p>
          <div className="space-y-1 text-base text-muted-foreground">
            <p><span className="text-blue-500 dark:text-blue-400 font-medium">Prompt processing: {timings?.prompt_per_second ? `${timings.prompt_per_second.toFixed(2)} tok/s` : "N/A"}</span> — how fast input tokens are processed</p>
            <p><span className="text-green-500 dark:text-green-400 font-medium">Token generation: {timings?.predicted_per_second ? `${timings.predicted_per_second.toFixed(2)} tok/s` : "N/A"}</span> — how fast output tokens are generated</p>
          </div>
        </div>
      ),
    },
    {
      label: "TTFT",
      value: log.latency_ms ? `${log.latency_ms}ms` : "N/A",
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Time to First Token (TTFT)</p>
          <p className="text-base text-muted-foreground">
            Time from sending the request to receiving the first token of the response. For streaming requests, this is the initial latency. For non-streaming, this equals total duration.
          </p>
        </div>
      ),
    },
    {
      label: "Total Duration",
      value: log.total_duration_ms ? `${log.total_duration_ms}ms` : "N/A",
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Total Duration</p>
          <p className="text-base text-muted-foreground">
            Total time from request to complete response. For streaming, this includes the entire generation time. For non-streaming, this equals TTFT.
          </p>
        </div>
      ),
    },
  ]

  const generationStats: StatWithExplanation[] = [
    {
      label: "Temperature",
      value: temperature !== undefined ? temperature.toString() : <span className="text-muted-foreground italic">Default</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Temperature</p>
          <p className="text-base text-muted-foreground">
            Controls randomness. Lower values (0.0-0.3) make output more deterministic. Higher values (0.7-2.0) make it more creative.
          </p>
          {temperature === undefined && <p className="text-xs text-muted-foreground italic">Not explicitly set in this request.</p>}
        </div>
      ),
    },
    {
      label: "Top P",
      value: topP !== undefined ? topP.toString() : <span className="text-muted-foreground italic">Default</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Top P (Nucleus Sampling)</p>
          <p className="text-base text-muted-foreground">
            Limits token selection to the smallest set whose cumulative probability exceeds this value. Range: 0.0-1.0. Lower = more focused output.
          </p>
          {topP === undefined && <p className="text-xs text-muted-foreground italic">Not explicitly set in this request.</p>}
        </div>
      ),
    },
    {
      label: "Max Tokens",
      value: maxTokens !== undefined ? maxTokens.toString() : <span className="text-muted-foreground italic">Unlimited</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Max Tokens</p>
          <p className="text-base text-muted-foreground">
            Maximum number of tokens the model can generate. If the response hits this limit, it will be truncated (finish_reason: "length").
          </p>
          {maxTokens === undefined && <p className="text-sm text-muted-foreground italic">Not set — model will generate until it naturally stops.</p>}
        </div>
      ),
    },
    {
      label: "Frequency Penalty",
      value: frequencyPenalty !== undefined ? frequencyPenalty.toString() : <span className="text-muted-foreground italic">0</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Frequency Penalty</p>
          <p className="text-base text-muted-foreground">
            Penalizes tokens based on their frequency in the text. Positive values reduce repetition. Range: -2.0 to 2.0. Default is 0.
          </p>
        </div>
      ),
    },
    {
      label: "Presence Penalty",
      value: presencePenalty !== undefined ? presencePenalty.toString() : <span className="text-muted-foreground italic">0</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Presence Penalty</p>
          <p className="text-base text-muted-foreground">
            Penalizes tokens that have already appeared in the text. Encourages the model to talk about new topics. Range: -2.0 to 2.0. Default is 0.
          </p>
        </div>
      ),
    },
  ]

  if (finishReason) {
    const finishReasonColors: Record<string, string> = {
      stop: "text-green-500 dark:text-green-400",
      length: "text-yellow-500 dark:text-yellow-400",
      tool_calls: "text-blue-500 dark:text-blue-400",
      content_filter: "text-red-500 dark:text-red-400",
    }
    generationStats.push({
      label: "Finish Reason",
      value: <span className={finishReasonColors[finishReason] || "text-foreground"}>{finishReason}</span>,
      explanation: (
        <div className="space-y-2">
          <p className="font-medium">Finish Reason</p>
          <p className="text-base text-muted-foreground">
            Why the model stopped generating:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-2 list-disc">
            <li><span className="text-green-500">stop</span> - Hit a natural stop sequence</li>
            <li><span className="text-yellow-500">length</span> - Hit max_tokens limit (truncated)</li>
            <li><span className="text-blue-500">tool_calls</span> - Model called a tool</li>
            <li><span className="text-red-500">content_filter</span> - Content was filtered</li>
          </ul>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1.85fr),minmax(0,1fr)] gap-x-8 gap-y-4">
        <div className="flex flex-col gap-y-4">
          {performanceStats.slice(0, 2).map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>
        <div className="flex flex-col gap-y-4">
          {performanceStats.slice(2).map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>
      </div>

      {generationStats.length > 0 && (
        <>
          <div className="border-t" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {generationStats.map((stat) => (
              <StatItem key={stat.label} stat={stat} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
