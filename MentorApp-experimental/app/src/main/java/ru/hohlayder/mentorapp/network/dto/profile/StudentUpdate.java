package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

public class StudentUpdate {
    @SerializedName("learning_goals")
    public String learningGoals;

    @SerializedName("preferred_learning_style")
    public String preferredLearningStyle;

    public StudentUpdate() {
    }

    public StudentUpdate(String learningGoals, String preferredLearningStyle) {
        this.learningGoals = learningGoals;
        this.preferredLearningStyle = preferredLearningStyle;
    }
}
