package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

public class LearningSkillUpdate {
    @SerializedName("skill_name")
    public String skillName;

    @SerializedName("proficiency_level")
    public String proficiencyLevel;

    public LearningSkillUpdate() {
    }

    public LearningSkillUpdate(String skillName, String proficiencyLevel) {
        this.skillName = skillName;
        this.proficiencyLevel = proficiencyLevel;
    }
}
