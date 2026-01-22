package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;

public class CursorDto {
    public String id;

    @SerializedName("created_at")
    public String createdAt;
}
