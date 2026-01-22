package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class SkillDto {
    @SerializedName("skill_name")
    public String skillName;

    @SerializedName("proficiency_level")
    public String proficiencyLevel;

    @SerializedName("years_of_experience")
    public int yearsOfExperience;
}
