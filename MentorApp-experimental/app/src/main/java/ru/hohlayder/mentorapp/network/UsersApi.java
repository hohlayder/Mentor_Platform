package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Path;
import ru.hohlayder.mentorapp.network.dto.user.UserCountResponse;
import ru.hohlayder.mentorapp.network.dto.user.UserDto;

public interface UsersApi {

    @GET("api/v1/users/all")
    Call<UserCountResponse> getUserCount();

    @GET("api/v1/users/email/{email}")
    Call<UserDto> getByEmail(@Path("email") String email);

    @GET("api/v1/users/{id}")
    Call<UserDto> getById(@Path("id") String id);
}
