package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;

public class ChatDto {

    public String id;

    @SerializedName("user1_id")
    public String user1Id;

    @SerializedName("user2_id")
    public String user2Id;

    @SerializedName("last_message")
    public MessageDto lastMessage;

    @SerializedName("unread_count")
    public int unreadCount;

    @SerializedName("created_at")
    public String createdAt;

    @SerializedName("updated_at")
    public String updatedAt;
}
