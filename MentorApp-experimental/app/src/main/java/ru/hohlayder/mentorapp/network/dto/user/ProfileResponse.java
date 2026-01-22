package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.List;

public class ProfileResponse {
    public ProfileDto profile;
    public UserPublicDto user;
    public MentorDataDto mentor;
    public StudentDataDto student;

    @SerializedName("teaching_skills")
    public JsonElement teachingSkillsRaw;

    @SerializedName("learning_skills")
    public JsonElement learningSkillsRaw;

    public ProfileDto getProfile() {
        if (profile != null) {
            if (profile.user == null) profile.user = user;
            if (profile.mentor == null) profile.mentor = mentor;
            if (profile.student == null) profile.student = student;

            if ((profile.teachingSkills == null || profile.teachingSkills.isEmpty()) && teachingSkillsRaw != null)
                profile.teachingSkills = parseSkills(teachingSkillsRaw);

            if ((profile.learningSkills == null || profile.learningSkills.isEmpty()) && learningSkillsRaw != null)
                profile.learningSkills = parseSkills(learningSkillsRaw);

            return profile;
        }

        ProfileDto p = new ProfileDto();
        p.user = user;
        p.mentor = mentor;
        p.student = student;
        p.teachingSkills = parseSkills(teachingSkillsRaw);
        p.learningSkills = parseSkills(learningSkillsRaw);
        return p;
    }

    private List<SkillDto> parseSkills(JsonElement raw) {
        if (raw == null || raw.isJsonNull()) return null;

        Gson gson = new Gson();
        Type listType = new TypeToken<List<SkillDto>>() {}.getType();

        try {
            if (raw.isJsonArray()) return gson.fromJson(raw, listType);
            if (!raw.isJsonObject()) return null;

            if (raw.getAsJsonObject().has("set")) {
                JsonElement x = raw.getAsJsonObject().get("set");
                if (x != null && x.isJsonArray()) return gson.fromJson(x, listType);
            }
            if (raw.getAsJsonObject().has("items")) {
                JsonElement x = raw.getAsJsonObject().get("items");
                if (x != null && x.isJsonArray()) return gson.fromJson(x, listType);
            }
            if (raw.getAsJsonObject().has("skills")) {
                JsonElement x = raw.getAsJsonObject().get("skills");
                if (x != null && x.isJsonArray()) return gson.fromJson(x, listType);
            }
        } catch (Exception ignored) {}

        return null;
    }

    public static class ProfileDto {
        public UserPublicDto user;
        public MentorDataDto mentor;
        public StudentDataDto student;

        @SerializedName("teaching_skills")
        public List<SkillDto> teachingSkills;

        @SerializedName("learning_skills")
        public List<SkillDto> learningSkills;
    }
}
