import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { useConversation } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Message } from "@/types/database";

interface ConversationPageProps {
  conversationId: number;
  onBack: () => void;
}

export function ConversationPage({ conversationId, onBack }: ConversationPageProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useConversation(conversationId);

  // Update local messages when data changes
  useEffect(() => {
    if (data?.messages) {
      setLocalMessages(data.messages);
    }
  }, [data?.messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingMessage]);

  const handleSend = async () => {
    if (!input.trim() || !data || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempUserMessage]);

    try {
      // Call the streaming API
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMessage,
          model_provider: data.conversation.model_provider,
          model_name: data.conversation.model_name,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text chunk from AI SDK stream
              try {
                const content = JSON.parse(line.substring(2));
                if (typeof content === "string") {
                  accumulatedText += content;
                  setStreamingMessage(accumulatedText);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // The assistant message is now saved automatically on the backend
      // Just add it to local state and refetch
      if (accumulatedText) {
        const tempAssistantMessage: Message = {
          id: Date.now() + 1,
          conversation_id: conversationId,
          role: "assistant",
          content: accumulatedText,
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, tempAssistantMessage]);
      }

      setStreamingMessage("");
      // Refetch to get the saved message with proper ID from database
      refetch();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="h-[calc(100vh-8rem)] flex flex-col">
        <CardHeader className="border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle>{data.conversation.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.conversation.model_provider} · {data.conversation.model_name}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {localMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Start a conversation by sending a message</p>
            </div>
          ) : (
            <>
              {localMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                    <Loader2 className="h-3 w-3 animate-spin mt-1" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 min-h-[60px] max-h-[200px]"
              disabled={isStreaming}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon" className="self-end">
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
