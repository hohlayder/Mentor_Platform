package domain

import "time"

type UserProfile struct {
	User           User            `db:"user"`
	Mentor         *Mentor         `db:"mentor"`
	Student        *Student        `db:"student"`
	TeachingSkills []TeachingSkill `db:"teaching_skills"`
	LearningSkills []LearningSkill `db:"learning_skills"`
}

type User struct {
	Id        string    `db:"id"`
	Email     string    `db:"email"`
	Name      string    `db:"name"`
	Surname   string    `db:"surname"`
	AvatarURL *string   `db:"avatar_url"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type Mentor struct {
	UserId      string   `db:"user_id"`
	Withdrawal  *string  `db:"withdrawal_address"`
	Rating      *float64 `db:"rating"`
	Description *string  `db:"description"`
}

type Student struct {
	UserId                 string  `db:"user_id"`
	LearningGoals          *string `db:"learning_goals"`
	PreferredLearningStyle *string `db:"preferred_learning_style"`
}

type TeachingSkill struct {
	Id                string `db:"id"`
	UserId            string `db:"user_id"`
	SkillName         string `db:"skill_name"`
	ProficiencyLevel  string `db:"proficiency_level"`
	YearsOfExperience int32  `db:"years_of_experience"`
}

type LearningSkill struct {
	Id               string `db:"id"`
	UserId           string `db:"user_id"`
	SkillName        string `db:"skill_name"`
	ProficiencyLevel string `db:"proficiency_level"`
}

type UpdateProfile struct {
	Id             string
	Email          *string `db:"email"`
	Name           *string `db:"name"`
	Surname        *string `db:"surname"`
	AvatarURL      *string `db:"avatar_url"`
	Mentor         *MentorUpdate
	Student        *StudentUpdate
	TeachingSkills *[]*TeachingSkillUpdate
	LearningSkill  *[]*LearningSkillUpdate
}

type MentorUpdate struct {
	Withdrawal  *string `db:"withdrawal_address"`
	Description *string `db:"description"`
}

type StudentUpdate struct {
	LearningGoals          *string `db:"learning_goals"`
	PreferredLearningStyle *string `db:"preferred_learning_style"`
}

type TeachingSkillUpdate struct {
	SkillName         string
	ProficiencyLevel  string
	YearsOfExperience *int32
}

type LearningSkillUpdate struct {
	SkillName        string
	ProficiencyLevel string
}
