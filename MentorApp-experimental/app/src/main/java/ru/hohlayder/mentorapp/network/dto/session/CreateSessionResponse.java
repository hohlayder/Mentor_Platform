package ru.hohlayder.mentorapp.network.dto.session;

import com.google.gson.annotations.SerializedName;

public class CreateSessionResponse {
    @SerializedName("session_id")
    public String sessionId;
    public Boolean success;
}