package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

import java.util.List;

public class TeachingSkillsUpdate {
    @SerializedName("teaching_skills")
    public List<TeachingSkillUpdate> teachingSkills;

    public TeachingSkillsUpdate() {
    }

    public TeachingSkillsUpdate(List<TeachingSkillUpdate> teachingSkills) {
        this.teachingSkills = teachingSkills;
    }
}
