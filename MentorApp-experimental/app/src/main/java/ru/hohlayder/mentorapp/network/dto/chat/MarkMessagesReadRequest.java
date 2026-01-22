package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class MarkMessagesReadRequest {
    @SerializedName("chat_id")
    public String chatId;

    @SerializedName("message_ids")
    public List<String> messageIds;

    public static MarkMessagesReadRequest of(String chatId, List<String> messageIds) {
        MarkMessagesReadRequest r = new MarkMessagesReadRequest();
        r.chatId = chatId;
        r.messageIds = messageIds;
        return r;
    }
}
