package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;

public class CreateChatResponse {
    @SerializedName("chat_id")
    public String chatId;
}
