package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;
import ru.hohlayder.mentorapp.network.dto.post.CreatePostRequest;
import ru.hohlayder.mentorapp.network.dto.post.GetPostResponse;
import ru.hohlayder.mentorapp.network.dto.post.ListPostsResponse;
import ru.hohlayder.mentorapp.network.dto.post.PostRateRequest;
import ru.hohlayder.mentorapp.network.dto.post.UpdatePostRequest;

public interface PostApi {
    @GET("api/v1/posts")
    Call<ListPostsResponse> listPosts(
            @Query("status") String status,
            @Query("author_id") String authorId,
            @Query("tags") String tagsCsv,
            @Query("search") String search,
            @Query("sort_field") String sortField,
            @Query("sort_order") String sortOrder,
            @Query("page_size") Integer pageSize,
            @Query("page_token") String pageToken,
            @Query("offset") Integer offset,
            @Query("limit") Integer limit
    );

    @GET("api/v1/posts/{id}")
    Call<GetPostResponse> getPost(@Path("id") String id);

    @POST("api/v1/posts")
    Call<GetPostResponse> createPost(@Body CreatePostRequest req);

    @PUT("api/v1/posts/{id}")
    Call<GetPostResponse> updatePost(@Path("id") String id, @Body UpdatePostRequest req);

    @DELETE("api/v1/posts/{id}")
    Call<Void> deletePost(@Path("id") String id);

    @POST("api/v1/posts/{id}/favorite")
    Call<Void> toggleFavorite(@Path("id") String id);

    @POST("api/v1/posts/{id}/rate")
    Call<Void> ratePost(@Path("id") String id, @Body PostRateRequest req);
}
