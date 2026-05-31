/**
 * Message Composer Component
 *
 * Compose and send direct messages to CRM clients.
 *
 * @module components/crm/messaging/message-composer
 */

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { notify } from "@/shared/lib/ui/notify";
import { useSendCrmMessage } from "@/features/crm/hooks/queries";

interface MessageComposerProps {
  clientId: string;
  clientName: string;
  channels?: { id: string; name: string; platform: string }[];
  onMessageSent?: () => void;
}

export function MessageComposer({
  clientId,
  clientName,
  channels = [],
  onMessageSent,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  const sendMutation = useSendCrmMessage();

  const handleSend = () => {
    if (!content.trim()) {
      notify.error("Please enter a message");
      return;
    }

    if (!selectedChannelId) {
      notify.error("Please select a channel");
      return;
    }

    sendMutation.mutate(
      {
        clientId,
        input: {
          channelId: selectedChannelId,
          content: content.trim(),
        },
      },
      {
        onSuccess: () => {
          setContent("");
          onMessageSent?.();
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Channel Selection */}
      <div className="space-y-2">
        <Label>Channel</Label>
        <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a channel to send from" />
          </SelectTrigger>
          <SelectContent>
            {channels.length === 0 ? (
              <SelectItem value="none" disabled>
                No channels available
              </SelectItem>
            ) : (
              channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name} ({channel.platform})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Message Input */}
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Write a message to ${clientName}...`}
          className="min-h-24 resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{user.firstName}}"}, {"{{user.lastName}}"}, {"{{user.username}}"} for personalization
        </p>
      </div>

      {/* Send Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSend}
          disabled={!content.trim() || !selectedChannelId || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Send Message
        </Button>
      </div>
    </div>
  );
}
