import { TavilySearch } from "@langchain/tavily";

export const webSearch = new TavilySearch({
  name: "web_search",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
});
