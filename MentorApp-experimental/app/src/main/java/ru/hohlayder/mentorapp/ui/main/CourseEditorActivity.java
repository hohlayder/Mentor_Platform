package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import ru.hohlayder.mentorapp.databinding.ActivityCourseEditorBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.FilesApi;
import ru.hohlayder.mentorapp.network.PostApi;
import ru.hohlayder.mentorapp.network.dto.post.CreatePostRequest;
import ru.hohlayder.mentorapp.network.dto.post.GetPostResponse;
import ru.hohlayder.mentorapp.network.dto.post.UpdatePostRequest;
import ru.hohlayder.mentorapp.network.dto.user.UploadAvatarResponse;
import ru.hohlayder.mentorapp.ui.util.ImageLoader;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CourseEditorActivity extends AppCompatActivity {
    private static final Pattern TAG_PATTERN =
            Pattern.compile("^[\\p{L}\\p{N}_ \\-]{1,32}$");

    private ActivityCourseEditorBinding b;
    private PostApi postApi;
    private FilesApi filesApi;
    private String mode;
    private String postId;

    private Uri selectedImage;
    private boolean removeImage;
    private boolean busy;

    private final ActivityResultLauncher<String> pickImage = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            uri -> {
                if (uri == null) return;
                selectedImage = uri;
                removeImage = false;
                previewSelected(uri);
                updateImageButtons();
            }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityCourseEditorBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        postApi = ApiClient.create(PostApi.class);
        filesApi = ApiClient.create(FilesApi.class);

        mode = getIntent().getStringExtra("mode");
        postId = getIntent().getStringExtra("post_id");

        b.btnPickImage.setOnClickListener(v -> pickImage.launch("image/*"));
        b.btnRemoveImage.setOnClickListener(v -> {
            selectedImage = null;
            removeImage = true;
            b.ivAvatar.setImageDrawable(null);
            updateImageButtons();
        });

        b.btnSaveDraft.setOnClickListener(v -> save("draft"));
        b.btnPublish.setOnClickListener(v -> save("published"));
        b.btnArchive.setOnClickListener(v -> save("archived"));

        updateImageButtons();

        if ("edit".equals(mode) && postId != null && !postId.isEmpty()) load();
    }

    private void setBusy(boolean v) {
        busy = v;
        b.progress.setVisibility(v ? View.VISIBLE : View.GONE);
        b.btnSaveDraft.setEnabled(!v);
        b.btnPublish.setEnabled(!v);
        b.btnArchive.setEnabled(!v);
        b.btnPickImage.setEnabled(!v);
        b.btnRemoveImage.setEnabled(!v && (selectedImage != null || removeImage == false));
    }

    private void updateImageButtons() {
        boolean hasSelected = selectedImage != null;
        b.btnRemoveImage.setEnabled(hasSelected || ("edit".equals(mode) && postId != null && !postId.isEmpty()));
    }

    private void previewSelected(Uri uri) {
        try {
            InputStream in = getContentResolver().openInputStream(uri);
            Bitmap bmp = BitmapFactory.decodeStream(in);
            if (bmp != null) b.ivAvatar.setImageBitmap(bmp);
        } catch (Exception e) {
            Toast.makeText(this, "Image read error", Toast.LENGTH_SHORT).show();
        }
    }

    private void load() {
        setBusy(true);
        postApi.getPost(postId).enqueue(new Callback<GetPostResponse>() {
            @Override
            public void onResponse(Call<GetPostResponse> call, Response<GetPostResponse> resp) {
                setBusy(false);
                if (!resp.isSuccessful() || resp.body() == null || resp.body().post == null) {
                    showHttpError("Load error", resp);
                    return;
                }
                b.etTitle.setText(resp.body().post.title == null ? "" : resp.body().post.title);
                b.etContent.setText(resp.body().post.content == null ? "" : resp.body().post.content);
                if (resp.body().post.tags != null && !resp.body().post.tags.isEmpty()) b.etTags.setText(join(resp.body().post.tags));
                else b.etTags.setText("");

                if (resp.body().post.avatarUrl != null && !resp.body().post.avatarUrl.isEmpty()) {
                    ImageLoader.loadPostAvatar(CourseEditorActivity.this, b.ivAvatar, resp.body().post.avatarUrl);
                } else {
                    b.ivAvatar.setImageDrawable(null);
                }
            }

            @Override
            public void onFailure(Call<GetPostResponse> call, Throwable t) {
                setBusy(false);
                Toast.makeText(CourseEditorActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void save(String status) {
        if (busy) return;

        String title = b.etTitle.getText().toString().trim();
        String content = b.etContent.getText().toString().trim();
        List<String> tags = parseTags(b.etTags.getText().toString());

        if (title.isEmpty() || content.isEmpty()) {
            Toast.makeText(this, "Title/content required", Toast.LENGTH_SHORT).show();
            return;
        }

        setBusy(true);

        if ("edit".equals(mode) && postId != null && !postId.isEmpty()) {
            UpdatePostRequest req = UpdatePostRequest.of(postId, title, content, tags, status, null);
            postApi.updatePost(postId, req).enqueue(new Callback<GetPostResponse>() {
                @Override
                public void onResponse(Call<GetPostResponse> call, Response<GetPostResponse> resp) {
                    if (!resp.isSuccessful() || resp.body() == null || resp.body().post == null) {
                        setBusy(false);
                        showHttpError("Save error", resp);
                        return;
                    }
                    afterPostSaved(resp.body().post.id);
                }

                @Override
                public void onFailure(Call<GetPostResponse> call, Throwable t) {
                    setBusy(false);
                    Toast.makeText(CourseEditorActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        } else {
            CreatePostRequest req = CreatePostRequest.of(title, content, tags, status, null);
            postApi.createPost(req).enqueue(new Callback<GetPostResponse>() {
                @Override
                public void onResponse(Call<GetPostResponse> call, Response<GetPostResponse> resp) {
                    if (!resp.isSuccessful() || resp.body() == null || resp.body().post == null) {
                        setBusy(false);
                        showHttpError("Create error", resp);
                        return;
                    }
                    afterPostSaved(resp.body().post.id);
                }

                @Override
                public void onFailure(Call<GetPostResponse> call, Throwable t) {
                    setBusy(false);
                    Toast.makeText(CourseEditorActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    private void afterPostSaved(String id) {
        if (id == null || id.isEmpty()) {
            setBusy(false);
            Toast.makeText(this, "Post id missing", Toast.LENGTH_SHORT).show();
            return;
        }

        if (removeImage) {
            filesApi.deletePostAvatar(id).enqueue(new Callback<Void>() {
                @Override
                public void onResponse(Call<Void> call, Response<Void> resp) {
                    setBusy(false);
                    Toast.makeText(CourseEditorActivity.this, "Saved", Toast.LENGTH_SHORT).show();
                    finish();
                }

                @Override
                public void onFailure(Call<Void> call, Throwable t) {
                    setBusy(false);
                    Toast.makeText(CourseEditorActivity.this, "Saved, but image delete failed", Toast.LENGTH_LONG).show();
                    finish();
                }
            });
            return;
        }

        if (selectedImage == null) {
            setBusy(false);
            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        uploadPostImage(id, selectedImage);
    }

    private void uploadPostImage(String id, Uri uri) {
        try {
            File f = copyToCache(uri, "post_avatar_" + id);
            RequestBody rb = RequestBody.create(f, MediaType.parse("image/*"));
            MultipartBody.Part part = MultipartBody.Part.createFormData("avatar", f.getName(), rb);

            filesApi.uploadPostAvatar(id, part).enqueue(new Callback<UploadAvatarResponse>() {
                @Override
                public void onResponse(Call<UploadAvatarResponse> call, Response<UploadAvatarResponse> resp) {
                    setBusy(false);
                    if (!resp.isSuccessful()) {
                        Toast.makeText(CourseEditorActivity.this, "Saved, but image upload failed: " + resp.code(), Toast.LENGTH_LONG).show();
                        finish();
                        return;
                    }
                    Toast.makeText(CourseEditorActivity.this, "Saved", Toast.LENGTH_SHORT).show();
                    finish();
                }

                @Override
                public void onFailure(Call<UploadAvatarResponse> call, Throwable t) {
                    setBusy(false);
                    Toast.makeText(CourseEditorActivity.this, "Saved, but image upload failed", Toast.LENGTH_LONG).show();
                    finish();
                }
            });
        } catch (Exception e) {
            setBusy(false);
            Toast.makeText(this, "Saved, but image read failed", Toast.LENGTH_LONG).show();
            finish();
        }
    }

    private File copyToCache(Uri uri, String name) throws Exception {
        InputStream in = getContentResolver().openInputStream(uri);
        File out = new File(getCacheDir(), name);
        FileOutputStream fos = new FileOutputStream(out);
        byte[] buf = new byte[8192];
        int r;
        while ((r = in.read(buf)) > 0) fos.write(buf, 0, r);
        fos.flush();
        fos.close();
        in.close();
        return out;
    }

    private void showHttpError(String prefix, Response<?> resp) {
        String body = "";
        try {
            if (resp.errorBody() != null) body = resp.errorBody().string();
        } catch (Exception ignored) {}

        if (body != null && !body.isEmpty()) Log.e("CourseEditor", body);
        String msg = prefix + ": " + resp.code() + (body == null || body.isEmpty() ? "" : " " + body);
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private List<String> parseTags(String s) {
        s = s == null ? "" : s.trim();
        List<String> out = new ArrayList<>();
        if (s.isEmpty()) return out;

        String[] parts = s.split(",");
        for (String p : parts) {
            String t = p.trim();
            if (t.isEmpty()) continue;

            t = t.replaceAll("\s+", " ");
            if (!TAG_PATTERN.matcher(t).matches()) continue;

            out.add(t);
            if (out.size() >= 20) break;
        }
        return out;
    }

    private String join(List<String> tags) {
        return Arrays.toString(tags.toArray()).replace("[", "").replace("]", "");
    }
}
