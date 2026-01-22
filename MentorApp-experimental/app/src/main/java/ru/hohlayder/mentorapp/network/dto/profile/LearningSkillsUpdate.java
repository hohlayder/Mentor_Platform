package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

import java.util.List;

public class LearningSkillsUpdate {
    @SerializedName("learning_skills")
    public List<LearningSkillUpdate> learningSkills;

    public LearningSkillsUpdate() {
    }

    public LearningSkillsUpdate(List<LearningSkillUpdate> learningSkills) {
        this.learningSkills = learningSkills;
    }
}
