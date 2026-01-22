package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class WsOutgoingMessage {
    @SerializedName("chat_id")
    public String chatId;

    public String content;

    @SerializedName("message_type")
    public String messageType;

    @SerializedName("reply_to")
    public String replyTo;

    public List<WsOutgoingAttachment> attachments;

    public static WsOutgoingMessage text(String chatId, String content) {
        WsOutgoingMessage m = new WsOutgoingMessage();
        m.chatId = chatId;
        m.content = content;
        m.messageType = "text";
        return m;
    }
}
