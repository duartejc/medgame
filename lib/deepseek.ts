import OpenAI from "openai";

export const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

let client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY não configurada. Copie .env.example para .env.local.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com/v1",
    });
  }
  return client;
}
