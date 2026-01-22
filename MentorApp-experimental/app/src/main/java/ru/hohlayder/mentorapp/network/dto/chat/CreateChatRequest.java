package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;

public class CreateChatRequest {
    @SerializedName("other_user_id")
    public String otherUserId;

    public static CreateChatRequest of(String otherUserId) {
        CreateChatRequest r = new CreateChatRequest();
        r.otherUserId = otherUserId;
        return r;
    }
}
