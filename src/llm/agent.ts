import { createAgent } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Agent } from "./types";
import { webSearch } from "./tools/websearch";

const systemPrompt = `
You are a helpful AI research assistant.

You have access to a "web_search" tool that can search the web for up to date information.
Use it to refine your answer or when the user asks about recent events, current stats, or anything you don't know the answer to.
`;

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
  model: "gemini-2.5-flash",
});

const agent: Agent = createAgent({
  model,
  tools: [webSearch],
  systemPrompt,
});

export default agent;
