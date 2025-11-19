import { createAgent } from "langchain";

export type Agent = Awaited<ReturnType<typeof createAgent>>;
