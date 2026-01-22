package ru.hohlayder.mentorapp.ui.main;

import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityProfileEditBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.FilesApi;
import ru.hohlayder.mentorapp.network.ProfilesApi;
import ru.hohlayder.mentorapp.network.dto.user.ProfileResponse;
import ru.hohlayder.mentorapp.network.dto.common.SuccessResponse;
import ru.hohlayder.mentorapp.network.dto.user.SkillDto;
import ru.hohlayder.mentorapp.network.dto.user.UploadAvatarResponse;
import ru.hohlayder.mentorapp.network.dto.profile.MentorUpdate;
import ru.hohlayder.mentorapp.network.dto.profile.StudentUpdate;
import ru.hohlayder.mentorapp.network.dto.profile.TeachingSkillUpdate;
import ru.hohlayder.mentorapp.network.dto.profile.TeachingSkillsUpdate;
import ru.hohlayder.mentorapp.network.dto.profile.UpdateProfileRequest;

public class ProfileEditActivity extends AppCompatActivity {
    private ActivityProfileEditBinding b;
    private SessionStore store;
    private ProfilesApi profilesApi;
    private FilesApi filesApi;

    private ProfileResponse.ProfileDto current;
    private String avatarUrl;

    private final ActivityResultLauncher<String> pickImage = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            uri -> { if (uri != null) uploadAvatar(uri); }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityProfileEditBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        store = new SessionStore(getApplicationContext());
        profilesApi = ApiClient.create(ProfilesApi.class);
        filesApi = ApiClient.create(FilesApi.class);

        b.btnBack.setOnClickListener(v -> finish());
        b.btnPickAvatar.setOnClickListener(v -> pickImage.launch("image/*"));
        b.btnSave.setOnClickListener(v -> save());

        load();
    }

    private void load() {
        String myId = store.getUserId();
        if (myId == null || myId.isEmpty()) {
            Toast.makeText(this, "No userId", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        profilesApi.getProfile(myId).enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(Call<ProfileResponse> call, Response<ProfileResponse> resp) {
                if (!resp.isSuccessful() || resp.body() == null) {
                    showHttpError("Profile load error", resp);
                    return;
                }
                current = resp.body().getProfile();
                bind();
            }

            @Override
            public void onFailure(Call<ProfileResponse> call, Throwable t) {
                Toast.makeText(ProfileEditActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void bind() {
        if (current == null || current.user == null) return;

        b.etFirstName.setText(current.user.firstName == null ? "" : current.user.firstName);
        b.etLastName.setText(current.user.lastName == null ? "" : current.user.lastName);
        b.etEmail.setText(current.user.email == null ? "" : current.user.email);

        if (current.mentor != null) {
            b.etMentorDesc.setText(current.mentor.description == null ? "" : current.mentor.description);
            b.etWithdrawal.setText(current.mentor.withdrawalAddress == null ? "" : current.mentor.withdrawalAddress);
        } else {
            b.etMentorDesc.setText("");
            b.etWithdrawal.setText("");
        }

        if (current.student != null) {
            b.etGoals.setText(current.student.learningGoals == null ? "" : current.student.learningGoals);
            b.etStyle.setText(current.student.preferredLearningStyle == null ? "" : current.student.preferredLearningStyle);
        } else {
            b.etGoals.setText("");
            b.etStyle.setText("");
        }

        avatarUrl = current.user.avatarUrl;
        b.tvAvatarInfo.setText(avatarUrl == null || avatarUrl.isEmpty() ? "Avatar: -" : "Avatar: " + avatarUrl);

        b.etSkills.setText(skillsToText(current.teachingSkills));
    }

    private void uploadAvatar(Uri uri) {
        try {
            InputStream is = getContentResolver().openInputStream(uri);
            if (is == null) {
                Toast.makeText(this, "File error", Toast.LENGTH_SHORT).show();
                return;
            }
            byte[] bytes = readAll(is);
            String name = getFileName(uri);
            if (name == null || name.isEmpty()) name = "avatar.jpg";

            RequestBody rb = RequestBody.create(bytes, MediaType.parse("image/*"));
            MultipartBody.Part part = MultipartBody.Part.createFormData("avatar", name, rb);

            filesApi.uploadAvatar(part).enqueue(new Callback<UploadAvatarResponse>() {
                @Override
                public void onResponse(Call<UploadAvatarResponse> call, Response<UploadAvatarResponse> resp) {
                    if (!resp.isSuccessful() || resp.body() == null || resp.body().avatarUrl == null) {
                        showHttpError("Upload error", resp);
                        return;
                    }
                    avatarUrl = resp.body().avatarUrl;
                    b.tvAvatarInfo.setText("Avatar: " + avatarUrl);
                    Toast.makeText(ProfileEditActivity.this, "Uploaded", Toast.LENGTH_SHORT).show();
                }

                @Override
                public void onFailure(Call<UploadAvatarResponse> call, Throwable t) {
                    Toast.makeText(ProfileEditActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        } catch (Exception e) {
            Toast.makeText(this, "Upload error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void save() {
        String myId = store.getUserId();
        if (myId == null || myId.isEmpty()) return;

        UpdateProfileRequest req = new UpdateProfileRequest();
        req.firstName = b.etFirstName.getText().toString().trim();
        req.lastName = b.etLastName.getText().toString().trim();
        req.email = b.etEmail.getText().toString().trim();
        req.avatarUrl = (avatarUrl == null || avatarUrl.trim().isEmpty()) ? null : avatarUrl.trim();

        MentorUpdate m = new MentorUpdate();
        m.description = b.etMentorDesc.getText().toString().trim();
        m.withdrawalAddress = b.etWithdrawal.getText().toString().trim();
        if (!m.description.isEmpty() || !m.withdrawalAddress.isEmpty()) req.mentorData = m;

        StudentUpdate s = new StudentUpdate();
        s.learningGoals = b.etGoals.getText().toString().trim();
        s.preferredLearningStyle = b.etStyle.getText().toString().trim();
        if (!s.learningGoals.isEmpty() || !s.preferredLearningStyle.isEmpty()) req.studentData = s;

        List<TeachingSkillUpdate> teaching = parseTeachingSkillsLenient(b.etSkills.getText().toString());
        req.teachingSkills = new TeachingSkillsUpdate(teaching);

        profilesApi.updateProfile(myId, req).enqueue(new Callback<SuccessResponse>() {
            @Override
            public void onResponse(Call<SuccessResponse> call, Response<SuccessResponse> resp) {
                if (resp.isSuccessful() && resp.body() != null && resp.body().success) {
                    Toast.makeText(ProfileEditActivity.this, "Saved", Toast.LENGTH_SHORT).show();
                    load();
                    return;
                }
                showHttpError("Save error", resp);
            }

            @Override
            public void onFailure(Call<SuccessResponse> call, Throwable t) {
                Toast.makeText(ProfileEditActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showHttpError(String prefix, Response<?> resp) {
        String body = "";
        try {
            if (resp.errorBody() != null) body = resp.errorBody().string();
        } catch (Exception ignored) {}

        if (body != null && !body.isEmpty()) Log.e("ProfileEdit", body);
        String msg = prefix + ": " + resp.code() + (body == null || body.isEmpty() ? "" : " " + body);
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private String skillsToText(List<SkillDto> list) {
        if (list == null || list.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            SkillDto s = list.get(i);
            sb.append(s.skillName == null ? "" : s.skillName).append("|")
                    .append(s.proficiencyLevel == null ? "" : s.proficiencyLevel).append("|")
                    .append(s.yearsOfExperience);
            if (i + 1 < list.size()) sb.append("\n");
        }
        return sb.toString();
    }

    private List<TeachingSkillUpdate> parseTeachingSkillsLenient(String text) {
        text = text == null ? "" : text.trim();
        List<TeachingSkillUpdate> out = new ArrayList<>();
        if (text.isEmpty()) return out;

        String[] lines = text.split("\n");
        for (String line : lines) {
            String l = line.trim();
            if (l.isEmpty()) continue;

            String[] p = l.split("\\|");
            String name;
            String level;
            int years;

            if (p.length == 1) {
                name = p[0].trim();
                level = "beginner";
                years = 0;
            } else {
                name = p[0].trim();
                level = p.length > 1 ? normalizeLevel(p[1].trim()) : "beginner";
                years = p.length > 2 ? parseIntSafe(p[2].trim()) : 0;
            }

            if (name == null) continue;
            name = name.trim();
            if (name.length() < 2) continue;
            if (name.length() > 50) name = name.substring(0, 50);

            if (level == null || level.isEmpty()) level = "beginner";
            level = normalizeLevel(level);

            if (years < 0) years = 0;
            if (years > 60) years = 60;

            out.add(new TeachingSkillUpdate(name, level, years));
            if (out.size() >= 50) break;
        }
        return out;
    }

    private String normalizeLevel(String v) {
        if (v == null) return "beginner";
        String s = v.trim().toLowerCase();
        if (s.equals("beginner") || s.equals("intermediate") || s.equals("advanced") || s.equals("expert")) return s;
        if (s.equals("junior")) return "beginner";
        if (s.equals("middle")) return "intermediate";
        if (s.equals("senior")) return "advanced";
        return "beginner";
    }

    private int parseIntSafe(String v) {
        try { return Integer.parseInt(v); } catch (Exception e) { return 0; }
    }

    private byte[] readAll(InputStream is) throws Exception {
        byte[] buf = new byte[8192];
        int r;
        java.io.ByteArrayOutputStream os = new java.io.ByteArrayOutputStream();
        while ((r = is.read(buf)) != -1) os.write(buf, 0, r);
        return os.toByteArray();
    }

    private String getFileName(Uri uri) {
        try {
            android.database.Cursor c = getContentResolver().query(uri, null, null, null, null);
            if (c == null) return null;
            int nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
            c.moveToFirst();
            String name = nameIdx >= 0 ? c.getString(nameIdx) : null;
            c.close();
            return name;
        } catch (Exception ignored) {}
        return null;
    }
}
