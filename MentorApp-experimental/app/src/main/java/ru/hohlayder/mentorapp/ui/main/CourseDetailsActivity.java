package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityCourseDetailsBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.PostApi;
import ru.hohlayder.mentorapp.network.dto.post.GetPostResponse;
import ru.hohlayder.mentorapp.network.dto.post.PostDto;
import ru.hohlayder.mentorapp.network.dto.post.PostRateRequest;
import ru.hohlayder.mentorapp.ui.util.ImageLoader;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CourseDetailsActivity extends AppCompatActivity {
    private ActivityCourseDetailsBinding b;
    private PostApi postApi;
    private SessionStore store;
    private String postId;
    private PostDto current;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityCourseDetailsBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        postApi = ApiClient.create(PostApi.class);
        store = new SessionStore(getApplicationContext());

        postId = getIntent().getStringExtra("post_id");
        if (postId == null || postId.isEmpty()) {
            finish();
            return;
        }

        b.btnFavorite.setOnClickListener(v -> favorite());
        b.btnRate.setOnClickListener(v -> rate());
        b.btnEdit.setOnClickListener(v -> edit());
        b.btnDelete.setOnClickListener(v -> confirmDelete());
        b.btnEnroll.setOnClickListener(v -> enrollOrSlots());

        load();
    }

    private void load() {
        postApi.getPost(postId).enqueue(new Callback<GetPostResponse>() {
            @Override
            public void onResponse(Call<GetPostResponse> call, Response<GetPostResponse> resp) {
                if (!resp.isSuccessful() || resp.body() == null || resp.body().post == null) {
                    Toast.makeText(CourseDetailsActivity.this, "Get post error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                current = resp.body().post;
                render();
            }

            @Override
            public void onFailure(Call<GetPostResponse> call, Throwable t) {
                Toast.makeText(CourseDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void render() {
        b.tvTitle.setText(current.title == null ? "" : current.title);
        String meta = (current.status == null ? "" : current.status) + " | rating " + current.averageRating + " (" + current.ratingsCount + ")";
        b.tvMeta.setText(meta);
        b.tvContent.setText(current.content == null ? "" : current.content);

        if (current.avatarUrl != null && !current.avatarUrl.isEmpty()) {
            ImageLoader.loadPostAvatar(this, b.ivAvatar, current.avatarUrl);
        } else {
            b.ivAvatar.setImageDrawable(null);
        }

        String myId = store.getUserId();
        boolean isAuthor = myId != null && current.authorId != null && myId.equals(current.authorId);

        b.btnEdit.setEnabled(isAuthor);
        b.btnDelete.setEnabled(isAuthor);

        b.btnEnroll.setText(isAuthor ? "Slots" : "Enroll");
    }

    private void enrollOrSlots() {
        if (current == null) return;
        String myId = store.getUserId();
        boolean isAuthor = myId != null && current.authorId != null && myId.equals(current.authorId);

        if (isAuthor) {
            Intent i = new Intent(this, SlotsManageActivity.class);
            i.putExtra("post_id", postId);
            startActivity(i);
            return;
        }

        Intent i = new Intent(this, EnrollActivity.class);
        i.putExtra("post_id", postId);
        startActivity(i);
    }

    private void favorite() {
        postApi.toggleFavorite(postId).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> resp) {
                Toast.makeText(CourseDetailsActivity.this, resp.isSuccessful() ? "OK" : "Favorite error: " + resp.code(), Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                Toast.makeText(CourseDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void rate() {
        String myId = store.getUserId();
        if (myId == null || myId.isEmpty()) {
            Toast.makeText(this, "No userId", Toast.LENGTH_SHORT).show();
            return;
        }

        RateDialog.show(this, (value, comment) -> {
            postApi.ratePost(postId, new PostRateRequest(value, myId, comment)).enqueue(new Callback<Void>() {
                @Override
                public void onResponse(Call<Void> call, Response<Void> resp) {
                    Toast.makeText(CourseDetailsActivity.this, resp.isSuccessful() ? "Rated" : "Rate error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    if (resp.isSuccessful()) load();
                }

                @Override
                public void onFailure(Call<Void> call, Throwable t) {
                    Toast.makeText(CourseDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    private void edit() {
        if (current == null) return;
        Intent i = new Intent(this, CourseEditorActivity.class);
        i.putExtra("mode", "edit");
        i.putExtra("post_id", postId);
        startActivity(i);
    }

    private void confirmDelete() {
        new AlertDialog.Builder(this)
                .setTitle("Delete")
                .setMessage("Delete this course?")
                .setPositiveButton("Yes", (d, w) -> delete())
                .setNegativeButton("No", null)
                .show();
    }

    private void delete() {
        postApi.deletePost(postId).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> resp) {
                if (resp.isSuccessful()) {
                    Toast.makeText(CourseDetailsActivity.this, "Deleted", Toast.LENGTH_SHORT).show();
                    finish();
                } else {
                    Toast.makeText(CourseDetailsActivity.this, "Delete error: " + resp.code(), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                Toast.makeText(CourseDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
