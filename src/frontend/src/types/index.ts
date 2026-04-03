export interface LogEntry {
  id: number;
  created_at: string | null;
  path: string;
  method: string;
  provider: string | null;
  model: string | null;
  request_headers: Record<string, string> | null;
  request_body_raw: string | null;
  request_body: ChatCompletionRequest | null;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body_raw: string | null;
  response_body: ChatCompletionResponse | null;
  is_stream: boolean;
  chunk_count: number;
  latency_ms: number | null;
  total_duration_ms: number | null;
  error_message: string | null;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: {
    type: string;
    json_schema?: {
      name?: string;
      schema?: {
        type?: string;
        properties?: Record<string, any>;
        required?: string[];
        items?: any;
        enum?: any[];
      };
    };
  };
}

export interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

export interface ChatMessage {
  role: string
  content: string | unknown[] | null
  reasoning_content?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatChoice[];
  usage: UsageInfo | null;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number | null;
  total_tokens: number;
}

export interface LogStats {
  total_requests: number;
  streaming_requests: number;
  non_streaming_requests: number;
  avg_latency_ms: number | null;
}

export interface Settings {
  upstream_url: string | null;
  tracing_paths?: string[];
}
