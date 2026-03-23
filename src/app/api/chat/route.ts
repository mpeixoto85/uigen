import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: UIMessage[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  // Convert UIMessages to ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages);

  const model = getLanguageModel();
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;

  const result = streamText({
    model,
    system: generationPrompt,
    messages: modelMessages,
    maxOutputTokens: 16_000,
    stopWhen: stepCountIs(isMockProvider ? 4 : 40),
    providerOptions: !isMockProvider
      ? {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 8000 },
            cacheControl: { type: "ephemeral" },
          },
        }
      : undefined,
    onError: (err: any) => {
      console.error(err);
    },
    tools: {
      str_replace_editor: buildStrReplaceTool(fileSystem),
      file_manager: buildFileManagerTool(fileSystem),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages }) => {
      if (projectId) {
        try {
          const session = await getSession();
          if (!session) {
            console.error("User not authenticated, cannot save project");
            return;
          }

          await prisma.project.update({
            where: {
              id: projectId,
              userId: session.userId,
            },
            data: {
              messages: JSON.stringify(allMessages),
              data: JSON.stringify(fileSystem.serialize()),
            },
          });
        } catch (error) {
          console.error("Failed to save project data:", error);
        }
      }
    },
  });
}

export const maxDuration = 120;
