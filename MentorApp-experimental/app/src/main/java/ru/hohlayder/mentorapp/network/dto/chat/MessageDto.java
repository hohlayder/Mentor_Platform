package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class MessageDto {
    public String id;

    @SerializedName("chat_id")
    public String chatId;

    @SerializedName("sender_id")
    public String senderId;

    public String content;

    @SerializedName("message_type")
    public String messageType;

    public List<AttachmentDto> attachments;

    @SerializedName("reply_to")
    public String replyTo;

    @SerializedName("created_at")
    public String createdAt;

    @SerializedName("updated_at")
    public String updatedAt;

    @SerializedName("deleted_at")
    public String deletedAt;

    @SerializedName("is_edited")
    public boolean isEdited;

    @SerializedName("is_read")
    public boolean isRead;

    @SerializedName("read_at")
    public String readAt;
}
