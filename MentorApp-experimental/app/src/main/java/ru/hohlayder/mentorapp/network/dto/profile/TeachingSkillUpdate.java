package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

public class TeachingSkillUpdate {
    @SerializedName("skill_name")
    public String skillName;

    @SerializedName("proficiency_level")
    public String proficiencyLevel;

    @SerializedName("years_of_experience")
    public Integer yearsOfExperience;

    public TeachingSkillUpdate() {
    }

    public TeachingSkillUpdate(String skillName, String proficiencyLevel, Integer yearsOfExperience) {
        this.skillName = skillName;
        this.proficiencyLevel = proficiencyLevel;
        this.yearsOfExperience = yearsOfExperience;
    }
}
