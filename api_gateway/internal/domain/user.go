package domain

import "time"

type User struct {
	UserID    string    `json:"user_id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ProfileResponse struct {
	User           User            `json:"user"`
	Mentor         *MentorProfile  `json:"mentor,omitempty"`
	Student        *StudentProfile `json:"student,omitempty"`
	TeachingSkills []TeachingSkill `json:"teaching_skills"`
	LearningSkills []LearningSkill `json:"learning_skills"`
}

type GetUserByIdRequest struct {
	UserId string
}

type GetUserByIdResponse struct {
	User User `json:"user"`
}

type GetUserByEmailRequest struct {
	Email string `json:"email"`
}

type MentorProfile struct {
	UserID            string  `json:"user_id"`
	WithdrawalAddress *string `json:"withdrawal_address,omitempty"`
	Rating            float64 `json:"rating"`
	Description       *string `json:"description,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type StudentProfile struct {
	UserID                 string  `json:"user_id"`
	LearningGoals          *string `json:"learning_goals,omitempty"`
	PreferredLearningStyle *string `json:"preferred_learning_style,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

type TeachingSkill struct {
	SkillID           string `json:"skill_id"`
	UserID            string `json:"user_id"`
	SkillName         string `json:"skill_name"`
	ProficiencyLevel  string `json:"proficiency_level"`
	YearsOfExperience int32  `json:"years_of_experience"`
	CreatedAt         time.Time `json:"created_at"`
}

type LearningSkill struct {
	SkillID          string `json:"skill_id"`
	UserID           string `json:"user_id"`
	SkillName        string `json:"skill_name"`
	ProficiencyLevel string `json:"proficiency_level"`
	CreatedAt        time.Time `json:"created_at"`
}

type CreateUserRequest struct {
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Email     string `json:"email" validate:"required,email"`
}

type CreateUserResponse struct {
	UserID string `json:"user_id"`
}

type UpdateProfileRequest struct {
	FirstName *string `json:"first_name,omitempty"`
	LastName  *string `json:"last_name,omitempty"`
	Email     *string `json:"email,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`

	MentorData  *MentorUpdate  `json:"mentor_data,omitempty"`
	StudentData *StudentUpdate `json:"student_data,omitempty"`

	TeachingSkills *TeachingSkillsUpdate `json:"teaching_skills,omitempty"`
	LearningSkills *LearningSkillsUpdate `json:"learning_skills,omitempty"`
}

type MentorUpdate struct {
	WithdrawalAddress *string `json:"withdrawal_address,omitempty"`
	Description       *string `json:"description,omitempty"`
}

type StudentUpdate struct {
	LearningGoals          *string `json:"learning_goals,omitempty"`
	PreferredLearningStyle *string `json:"preferred_learning_style,omitempty"`
}

type TeachingSkillsUpdate struct {
	TeachingSkills []TeachingSkillUpdate `json:"teaching_skills"`
}

type TeachingSkillUpdate struct {
	SkillName         string `json:"skill_name" validate:"required"`
	ProficiencyLevel  string `json:"proficiency_level" validate:"required"`
	YearsOfExperience int32  `json:"years_of_experience"`
}

type LearningSkillsUpdate struct {
	LearningSkills []LearningSkillUpdate `json:"learning_skills"`
}

type LearningSkillUpdate struct {
	SkillName        string `json:"skill_name" validate:"required"`
	ProficiencyLevel string `json:"proficiency_level" validate:"required"`
}

type UserCountResponse struct {
	UserCount string `json:"user_count"`
}