
export interface OpenAIResponse {
  content: string;
  source: 'openai' | 'error';
}

export type ProcessOpenAIFn = (params: {
  input: string;
  dbContext: string;
}) => Promise<OpenAIResponse>;

export async function processWithOpenAI(
  input: string,
  dbContext: string,
  processor?: ProcessOpenAIFn,
): Promise<OpenAIResponse> {
  if (!processor) {
    return {
      content: "OpenAI sunucu bağlantısı hazır değil.",
      source: 'error'
    };
  }
  return await processor({ input, dbContext });
}
