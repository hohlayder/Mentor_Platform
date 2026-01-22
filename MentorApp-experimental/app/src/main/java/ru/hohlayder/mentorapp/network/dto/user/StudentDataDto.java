package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class StudentDataDto {
    @SerializedName("learning_goals")
    public String learningGoals;

    @SerializedName("preferred_learning_style")
    public String preferredLearningStyle;
}
