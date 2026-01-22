package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import ru.hohlayder.mentorapp.network.dto.user.ProfileResponse;
import ru.hohlayder.mentorapp.network.dto.common.SuccessResponse;
import ru.hohlayder.mentorapp.network.dto.profile.UpdateProfileRequest;

public interface ProfilesApi {
    @GET("api/v1/profiles/{id}")
    Call<ProfileResponse> getProfile(@Path("id") String id);

    @PUT("api/v1/profiles/{id}")
    Call<SuccessResponse> updateProfile(@Path("id") String id, @Body UpdateProfileRequest req);
}
