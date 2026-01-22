package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;
import ru.hohlayder.mentorapp.network.dto.auth.LoginRequest;
import ru.hohlayder.mentorapp.network.dto.auth.LoginResponse;
import ru.hohlayder.mentorapp.network.dto.auth.RefreshRequest;
import ru.hohlayder.mentorapp.network.dto.auth.RefreshResponse;
import ru.hohlayder.mentorapp.network.dto.RegisterRequest;
import ru.hohlayder.mentorapp.network.dto.auth.RegisterResponse;

public interface AuthApi {
    @POST("api/v1/auth/register")
    Call<RegisterResponse> register(@Body RegisterRequest req);

    @POST("api/v1/auth/login")
    Call<LoginResponse> login(@Body LoginRequest req);

    @POST("api/v1/auth/refresh")
    Call<RefreshResponse> refresh(@Body RefreshRequest req);

    @POST("api/v1/auth/logout")
    Call<Void> logout();
}
