package ru.hohlayder.mentorapp.network.dto.auth;

public class RefreshRequest {
    public String refresh_token;

    public RefreshRequest(String refreshToken) {
        this.refresh_token = refreshToken;
    }
}
