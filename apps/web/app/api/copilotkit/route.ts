import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

// Lazy initialization to avoid build-time errors when env vars aren't available
let openai: OpenAI | null = null;
let serviceAdapter: OpenAIAdapter | null = null;
let runtime: CopilotRuntime | null = null;

function getRuntime() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!serviceAdapter) {
    serviceAdapter = new OpenAIAdapter({ openai } as any);
  }
  if (!runtime) {
    runtime = new CopilotRuntime({
      agents: {
        'supervisor': new LangGraphHttpAgent({
          url: process.env.AGENT_URL || "http://localhost:8000",
        }),
      },
    });
  }
  return { runtime, serviceAdapter };
}

export const POST = async (req: NextRequest) => {
  const { runtime, serviceAdapter } = getRuntime();
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
