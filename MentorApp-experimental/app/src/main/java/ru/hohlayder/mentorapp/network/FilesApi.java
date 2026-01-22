package ru.hohlayder.mentorapp.network;

import okhttp3.MultipartBody;
import retrofit2.Call;
import retrofit2.http.DELETE;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.Part;
import retrofit2.http.Path;
import ru.hohlayder.mentorapp.network.dto.user.UploadAvatarResponse;

public interface FilesApi {
    @Multipart
    @POST("api/v1/files/avatar")
    Call<UploadAvatarResponse> uploadAvatar(@Part MultipartBody.Part avatar);

    @DELETE("api/v1/files/avatar")
    Call<Void> deleteAvatar();

    @Multipart
    @POST("api/v1/files/posts/avatar/{post_id}")
    Call<UploadAvatarResponse> uploadPostAvatar(@Path("post_id") String postId, @Part MultipartBody.Part avatar);

    @DELETE("api/v1/files/posts/avatar/{post_id}")
    Call<Void> deletePostAvatar(@Path("post_id") String postId);
}