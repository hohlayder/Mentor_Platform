package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

public class UpdateProfileRequest {
    @SerializedName("avatar_url")
    public String avatarUrl;

    @SerializedName("email")
    public String email;

    @SerializedName("first_name")
    public String firstName;

    @SerializedName("last_name")
    public String lastName;

    @SerializedName("mentor_data")
    public MentorUpdate mentorData;

    @SerializedName("student_data")
    public StudentUpdate studentData;

    @SerializedName("teaching_skills")
    public TeachingSkillsUpdate teachingSkills;

    @SerializedName("learning_skills")
    public LearningSkillsUpdate learningSkills;

    public UpdateProfileRequest() {
    }
}
