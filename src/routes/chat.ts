import { Router, Request, Response } from "express";
import agent from "../llm/agent";
import { truncate } from "../utils";

interface ChatRequest {
  query: string;
}

const router = Router();

router.post("/", async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  // Extract query from request body and validate it
  const { query } = req.body;
  if (!query) {
    return res.status(400).send("Query is required");
  }

  // set up streaming response
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");

  const writeStream = (data: any) => {
    res.write(JSON.stringify(data));
  };

  try {
    // Immediately notify the client that thinking processs has started
    writeStream({
      type: "reasoning",
      content: `Analyzing your query: ${query} and deciding whether I need to search the web for up-to-date information.`,
    });

    // Track if the agent uses the web search tool
    let pendingWebSearchToolCallInput: unknown | null = null;

    // Stream the agent updates
    const stream = await agent.stream(
      {
        messages: [{ role: "user", content: query }],
      },
      {
        streamMode: "updates",
      }
    );

    for await (const update of stream) {
      // MODEL STEP
      if ("model_request" in update) {
        const mr = update.model_request;
        const aiMessage = mr.messages?.[0] as any; // AIMessage
        const toolCalls = aiMessage.tool_calls ?? [];

        if (toolCalls.length > 0) {
          // agent is planning to use a tool
          const toolCall = toolCalls[0];
          const toolName: string = toolCall.name ?? "unknown";
          const toolArgs = toolCall.args ?? {};

          pendingWebSearchToolCallInput = toolArgs;

          // notify client that agent is using a tool
          writeStream({
            type: "reasoning",
            content: `I need more information to answer the question. I am going to search the web with the tool ${toolName} for up-to-date information using input: ${truncate(
              JSON.stringify(toolArgs)
            )}.`,
          });
        } else {
          // agent is done reasoning and we have the final answer.
          writeStream({
            type: "response",
            content: aiMessage.content,
          });
        }
      }

      // TOOLS STEP (output)
      if ("tools" in update) {
        // extract tool information
        const toolsUpdate = update.tools;
        const toolMsg = toolsUpdate.messages?.[0] as any; // ToolMessage

        const toolName: string = toolMsg.name ?? "unknown_tool";
        const toolOutput: string = toolMsg.content;

        // notify client of the tool call
        writeStream({
          type: "tool_call",
          tool: toolName,
          input: JSON.stringify(pendingWebSearchToolCallInput),
          output: toolOutput,
        });

        // notify client that the agent has received the tool output and is reasoning
        writeStream({
          type: "reasoning",
          content: `Received results from "${toolName}" tool and using them to craft a grounded answer on "${query}"...`,
        });
      }
    }
  } catch (error) {
    // If headers haven't been sent, use a normal error response
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }

    // If headers have been sent, use a streaming error response
    writeStream({
      type: "error",
      content: "Internal server error",
    });
  } finally {
    // end streaming
    res.end();
  }
});

export default router;
