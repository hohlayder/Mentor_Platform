package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"
	"github.com/jmoiron/sqlx"
)

type UserRepositoryPostgres struct {
	db *sqlx.DB
}

func NewUserRepositoryPostgres(db *sqlx.DB) *UserRepositoryPostgres {
	return &UserRepositoryPostgres{db: db}
}

func (r *UserRepositoryPostgres) CreateUser(ctx context.Context, name string, surname string, email string) (string, error) {
	var userId string
	query := `INSERT INTO users (email, name, surname) VALUES ($1, $2, $3) RETURNING id`
	row := r.db.QueryRowContext(ctx, query, email, name, surname)
	if err := row.Scan(&userId); err != nil {
		return "", fmt.Errorf("failed to get user id: %w", err)
	}

	return userId, nil
}

func (r *UserRepositoryPostgres) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	query := `SELECT * FROM users WHERE email=$1`
	err := r.db.GetContext(ctx, &user, query, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}

		return nil, err
	}

	return &user, nil
}

func (r *UserRepositoryPostgres) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	query := `SELECT * FROM users WHERE id=$1`
	err := r.db.GetContext(ctx, &user, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}

		return nil, err
	}

	return &user, nil
}

func (r *UserRepositoryPostgres) GetCountUser(ctx context.Context) (int64, error) {
	var count int64
	query := `SELECT COUNT(id) FROM users`
	err := r.db.GetContext(ctx, &count, query)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (r *UserRepositoryPostgres) DeleteUser(ctx context.Context, id string) error {
	query := `DELETE FROM users WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user with id=%s: %w", id, err)
	}

	return nil
}

func (r *UserRepositoryPostgres) GetProfileByID(ctx context.Context, id string) (*domain.UserProfile, error) {
	var rows []domain.UserProfileRow
	query := `SELECT u.id, u.email, u.name, u.surname, u.avatar_url, u.created_at,
            m.user_id as mentor_user_id, m.withdrawal_address, m.rating, m.description, m.created_at as mentor_created_at,
            s.user_id as student_user_id, s.learning_goals, s.preferred_learning_style, s.created_at as student_created_at,
                    ts.id as ts_id, ts.skill_name as teaching_skill_name, ts.proficiency_level as teaching_level, ts.years_of_experience,
                    ts.created_at as ts_created_at,
                    ls.id as ls_id, ls.skill_name as learning_skill_name, ls.proficiency_level as learning_level,
                    ls.created_at as ls_created_at
                    FROM users AS u
            LEFT JOIN mentors AS m ON u.id = m.user_id
            LEFT JOIN students AS s ON u.id = s.user_id
            LEFT JOIN learning_skills as ls ON ls.user_id = s.user_id
            LEFT JOIN teaching_skills as ts ON ts.user_id = m.user_id
                WHERE u.id=$1`

	err := r.db.SelectContext(ctx, &rows, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}

		return nil, err
	}

	if len(rows) == 0 {
		return nil, errors.New("profile not found")
	}

	return r.buildUserProfileFromRows(rows), nil
}

func (r *UserRepositoryPostgres) buildUserProfileFromRows(rows []domain.UserProfileRow) *domain.UserProfile {
	if len(rows) == 0 {
		return nil
	}

	firstRow := rows[0]

	profile := &domain.UserProfile{
		User: domain.User{
			Id:        firstRow.ID,
			Email:     firstRow.Email,
			Name:      firstRow.Name,
			Surname:   firstRow.Surname,
			AvatarURL: firstRow.AvatarURL,
			CreatedAt: firstRow.CreatedAt,
		},
	}

	if firstRow.MUserID != nil {
		profile.Mentor = &domain.Mentor{
			UserId:      *firstRow.MUserID,
			Withdrawal:  firstRow.WithdrawalAddress,
			Rating:      firstRow.Rating,
			Description: firstRow.Description,
			CreatedAt:   firstRow.MCreatedAt,
		}
	}
	if firstRow.SUserID != nil {
		profile.Student = &domain.Student{
			UserId:                 *firstRow.SUserID,
			LearningGoals:          firstRow.LearningGoals,
			PreferredLearningStyle: firstRow.PreferredLearningStyle,
			CreatedAt:              firstRow.SCreatedAt,
		}
	}

	teachingSkillsMap := make(map[string]domain.TeachingSkill)
	for _, row := range rows {
		if row.TsID != nil {
			skillID := *row.TsID
			if _, exists := teachingSkillsMap[skillID]; !exists {
				teachingSkillsMap[skillID] = domain.TeachingSkill{
					Id:                *row.TsID,
					UserId:            firstRow.ID,
					SkillName:         *row.TsSkillName,
					ProficiencyLevel:  *row.TsProficiencyLevel,
					YearsOfExperience: *row.TsYears,
					CreatedAt:         *row.TsCreatedAt,
				}
			}
		}
	}

	for _, skill := range teachingSkillsMap {
		profile.TeachingSkills = append(profile.TeachingSkills, skill)
	}

	learningSkillsMap := make(map[string]domain.LearningSkill)
	for _, row := range rows {
		if row.LsID != nil {
			skillID := *row.LsID
			if _, exists := learningSkillsMap[skillID]; !exists {
				learningSkillsMap[skillID] = domain.LearningSkill{
					Id:               *row.LsID,
					UserId:           firstRow.ID,
					SkillName:        *row.LsSkillName,
					ProficiencyLevel: *row.LsProficiencyLevel,
					CreatedAt:        *row.LsCreatedAt,
				}
			}
		}
	}

	for _, skill := range learningSkillsMap {
		profile.LearningSkills = append(profile.LearningSkills, skill)
	}

	return profile
}

func (r *UserRepositoryPostgres) UpdateProfile(ctx context.Context, profile *domain.UpdateProfile) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}

	defer tx.Rollback()
	err = r.UpdateProfileUser(ctx, tx, profile.Id, profile.Email, profile.Name, profile.Surname, profile.AvatarURL)
	if err != nil {
		return fmt.Errorf("failed to update user part of profile: %w", err)
	}

	if profile.Mentor != nil {
		if err := r.UpdateOrCreateProfileMentor(ctx, tx, profile.Id, profile.Mentor); err != nil {
			return err
		}
	}

	if profile.Student != nil {
		if err := r.UpdateOrCreateProfileStudent(ctx, tx, profile.Id, profile.Student); err != nil {
			return err
		}
	}

	if profile.LearningSkill != nil {
		if err := r.UpdateLearningSkills(ctx, tx, profile.Id, profile.LearningSkill); err != nil {
			return err
		}
	}

	if profile.TeachingSkills != nil {
		if err := r.UpdateTeachingSkills(ctx, tx, profile.Id, profile.TeachingSkills); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *UserRepositoryPostgres) UpdateProfileUser(ctx context.Context, tx *sqlx.Tx, id string, email *string, name *string, surname *string, avatarURL *string) error {
	query := `UPDATE users SET `
	args := []interface{}{}
	argCount := 0
	if email != nil {
		argCount++
		query += fmt.Sprintf("email=$%d, ", argCount)
		args = append(args, *email)
	}

	if name != nil {
		argCount++
		query += fmt.Sprintf("name=$%d, ", argCount)
		args = append(args, *name)
	}

	if surname != nil {
		argCount++
		query += fmt.Sprintf("surname=$%d, ", argCount)
		args = append(args, *surname)
	}

	if avatarURL != nil {
		argCount++
		query += fmt.Sprintf("avatar_url=$%d, ", argCount)
		args = append(args, *avatarURL)
	}

	if argCount == 0 {
		return nil
	}

	query = strings.TrimSuffix(query, ", ")

	query += fmt.Sprintf(` WHERE id=$%d`, argCount+1)
	args = append(args, id)

	_, err := tx.ExecContext(ctx, query, args...)

	return err
}

func (r *UserRepositoryPostgres) UpdateOrCreateProfileMentor(ctx context.Context, tx *sqlx.Tx, id string, mentorProfile *domain.MentorUpdate) error {
	exists, err := r.ExistsMentorProfile(ctx, tx, id)
	if err != nil {
		return fmt.Errorf("failed to check mentor exists: %w", err)
	}

	if !exists {
		return r.CreateProfileMentor(ctx, tx, id, mentorProfile)
	}

	return r.UpdateProfileMentor(ctx, tx, id, mentorProfile)
}

func (r *UserRepositoryPostgres) ExistsMentorProfile(ctx context.Context, tx *sqlx.Tx, id string) (bool, error) {
	var exists bool

	query := `SELECT EXISTS (
        SELECT 1 FROM mentors
        WHERE user_id=$1
    )`

	err := tx.GetContext(ctx, &exists, query, id)
	if err != nil {
		return false, fmt.Errorf("failed to get mentor: %w", err)
	}

	return exists, nil
}

func (r *UserRepositoryPostgres) CreateProfileMentor(ctx context.Context, tx *sqlx.Tx, id string, mentorProfile *domain.MentorUpdate) error {
	query := `INSERT INTO mentors(user_id, withdrawal_address, description) VALUES ($1, $2, $3)`
	_, err := tx.ExecContext(ctx, query, id, mentorProfile.Withdrawal, mentorProfile.Description)
	if err != nil {
		return fmt.Errorf("failed to create mentor: %w", err)
	}

	return nil
}

func (r *UserRepositoryPostgres) UpdateProfileMentor(ctx context.Context, tx *sqlx.Tx, id string, mentorProfile *domain.MentorUpdate) error {
	query := `UPDATE mentors SET `
	args := []interface{}{}
	argCount := 0
	if mentorProfile.Description != nil {
		argCount++
		query += fmt.Sprintf(`description=$%d, `, argCount)
		args = append(args, *mentorProfile.Description)
	}

	if mentorProfile.Withdrawal != nil {
		argCount++
		query += fmt.Sprintf(`withdrawal_address=$%d, `, argCount)
		args = append(args, *mentorProfile.Withdrawal)
	}

	if argCount == 0 {
		return nil
	}

	query = strings.TrimSuffix(query, ", ")

	query += fmt.Sprintf(` WHERE user_id=$%d`, argCount+1)
	args = append(args, id)

	_, err := tx.ExecContext(ctx, query, args...)

	return err
}

func (r *UserRepositoryPostgres) UpdateOrCreateProfileStudent(ctx context.Context, tx *sqlx.Tx, id string, studentProfile *domain.StudentUpdate) error {
	exists, err := r.ExistsStudentProfile(ctx, tx, id)
	if err != nil {
		return fmt.Errorf("failed to check student exists: %w", err)
	}

	if !exists {
		return r.CreateProfileStudent(ctx, tx, id, studentProfile)
	}

	return r.UpdateProfileStudent(ctx, tx, id, studentProfile)
}

func (r *UserRepositoryPostgres) ExistsStudentProfile(ctx context.Context, tx *sqlx.Tx, id string) (bool, error) {
	var exists bool

	query := `SELECT EXISTS (
        SELECT 1 FROM students
        WHERE user_id=$1
    )`

	err := tx.GetContext(ctx, &exists, query, id)
	if err != nil {
		return false, fmt.Errorf("failed to get student: %w", err)
	}

	return exists, nil
}

func (r *UserRepositoryPostgres) CreateProfileStudent(ctx context.Context, tx *sqlx.Tx, id string, studentProfile *domain.StudentUpdate) error {
	query := `INSERT INTO students(user_id, learning_goals, preferred_learning_style) VALUES ($1, $2, $3)`
	_, err := tx.ExecContext(ctx, query, id, studentProfile.LearningGoals, studentProfile.PreferredLearningStyle)
	if err != nil {
		return fmt.Errorf("failed to create students: %w", err)
	}

	return nil
}

func (r *UserRepositoryPostgres) UpdateProfileStudent(ctx context.Context, tx *sqlx.Tx, id string, studentProfile *domain.StudentUpdate) error {
	query := `UPDATE students SET `
	args := []interface{}{}
	argCount := 0
	if studentProfile.PreferredLearningStyle != nil {
		argCount++
		query += fmt.Sprintf(`preferred_learning_style=$%d, `, argCount)
		args = append(args, *studentProfile.PreferredLearningStyle)
	}

	if studentProfile.LearningGoals != nil {
		argCount++
		query += fmt.Sprintf(`learning_goals=$%d, `, argCount)
		args = append(args, *studentProfile.LearningGoals)
	}

	if argCount == 0 {
		return nil
	}

	query = strings.TrimSuffix(query, ", ")

	query += fmt.Sprintf(` WHERE user_id=$%d`, argCount+1)
	args = append(args, id)

	_, err := tx.ExecContext(ctx, query, args...)

	return err
}

func (r *UserRepositoryPostgres) UpdateLearningSkills(ctx context.Context, tx *sqlx.Tx, id string, learningSkills *[]*domain.LearningSkillUpdate) error {
	exists, err := r.ExistsStudentProfile(ctx, tx, id)
    if err != nil {
        return fmt.Errorf("failed to check user exists: %w", err)
    }

    if !exists {
        err := r.CreateProfileStudent(ctx, tx, id, &domain.StudentUpdate{})
        if err != nil {
            return fmt.Errorf("failed to create mentor profile: %w", err)
        }
    }
	
	query := `DELETE FROM learning_skills WHERE user_id=$1`

	_, err = tx.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete learning skills: %w", err)
	}

	queryInsert := `INSERT INTO learning_skills (user_id, skill_name, proficiency_level) VALUES ($1, $2, $3)`
	stmt, err := tx.PrepareContext(ctx, queryInsert)
    if err != nil {
        return fmt.Errorf("failed to prepare statement: %w", err)
    }
    defer stmt.Close()

	for _, skill := range *learningSkills {
		_, err := stmt.ExecContext(ctx, id, skill.SkillName, skill.ProficiencyLevel)
		if err != nil {
			return fmt.Errorf("failed to save learning skill: %w", err)
		}
	}

	return nil
}

func (r *UserRepositoryPostgres) UpdateTeachingSkills(ctx context.Context, tx *sqlx.Tx, id string, teachingSkills *[]*domain.TeachingSkillUpdate) error {
	exists, err := r.ExistsMentorProfile(ctx, tx, id)
    if err != nil {
        return fmt.Errorf("failed to check user exists: %w", err)
    }

    if !exists {
        err := r.CreateProfileMentor(ctx, tx, id, &domain.MentorUpdate{})
        if err != nil {
            return fmt.Errorf("failed to create mentor profile: %w", err)
        }
    }

	query := `DELETE FROM teaching_skills WHERE user_id=$1`
	_, err = tx.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete teaching skills: %w", err)
	}

	queryInsert := `INSERT INTO teaching_skills (user_id, skill_name, proficiency_level, years_of_experience) VALUES ($1, $2, $3, $4)`
	stmt, err := tx.PrepareContext(ctx, queryInsert)
    if err != nil {
        return fmt.Errorf("failed to prepare statement: %w", err)
    }
    defer stmt.Close()

	for _, skill := range *teachingSkills {
		_, err := stmt.ExecContext(ctx, id, skill.SkillName, skill.ProficiencyLevel, skill.YearsOfExperience)
		if err != nil {
			return fmt.Errorf("failed to save teaching skill: %w", err)
		}
	}

	return nil
}

