import { useState } from "react";
import { Copy, RotateCcw, Edit2, Trash2, Check } from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface MessageActionsProps {
  messageId: number;
  role: "user" | "assistant";
  content: string;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageActions({
  messageId,
  role,
  content,
  onRegenerate,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Copy button - available for all messages */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copied ? "Copied!" : "Copy message"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Edit button - only for user messages */}
        {role === "user" && onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label="Edit message"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit message</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Regenerate button - only for assistant messages */}
        {role === "assistant" && onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRegenerate}
                aria-label="Regenerate response"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Regenerate response</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Delete button - available for all messages */}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                className="hover:text-destructive"
                aria-label="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete message</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
