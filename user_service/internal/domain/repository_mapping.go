package domain

import "time"

type UserProfileRow struct {
	ID        string    `db:"id"`
	Email     string    `db:"email"`
	Name      string    `db:"name"`
	Surname   string    `db:"surname"`
	AvatarURL *string   `db:"avatar_url"`
	CreatedAt time.Time `db:"created_at"`

	MUserID           *string  `db:"mentor_user_id"`
	WithdrawalAddress *string  `db:"withdrawal_address"`
	Rating            *float64 `db:"rating"`
	Description       *string  `db:"description"`

	SUserID                *string `db:"student_user_id"`
	LearningGoals          *string `db:"learning_goals"`
	PreferredLearningStyle *string `db:"preferred_learning_style"`

	TsID               *string `db:"ts_id"`
	TsSkillName        *string `db:"teaching_skill_name"`
	TsProficiencyLevel *string `db:"teaching_level"`
	TsYears            *int32  `db:"years_of_experience"`

	LsID               *string `db:"ls_id"`
	LsSkillName        *string `db:"learning_skill_name"`
	LsProficiencyLevel *string `db:"learning_level"`
}
