package service

import (
	"context"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

type UserClient interface {
    CreateUser(ctx context.Context, in *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error)
    GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error)
    GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error)
	GetUserCount(ctx context.Context, in *userv1.GetUserCountRequest) (*userv1.GetUserCountResponse, error)
    DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error)
    GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error)
    UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error)
    UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest) (*userv1.UploadAvatarResponse, error)
    DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest) (*userv1.DeleteAvatarResponse, error)
}

type UserService struct {
	client UserClient
}

func NewUserService(client UserClient) *UserService {
	return &UserService{client: client}
}

func (s *UserService) CreateUser(ctx context.Context, req *domain.CreateUserRequest) (*domain.CreateUserResponse, error) {
	grpcReq := userv1.CreateUserRequest{
		FirstName: req.FirstName,
		LastName: req.LastName,
		Email: req.Email,
	}
	
	grpcResp, err := s.client.CreateUser(ctx, &grpcReq)
	if err != nil {
		return nil, err
	}

	return &domain.CreateUserResponse{
		UserID: grpcResp.UserId,
	}, nil
}

func (s *UserService) GetUserByID(ctx context.Context, userId string) (*domain.User, error) {
	grpcReq := userv1.GetUserByIdRequest{
		UserId: userId,
	}

	grpcResp, err := s.client.GetUserById(ctx, &grpcReq)
	if err != nil {
		return nil, err
	}

	return &domain.User{
		UserID: grpcResp.User.UserId,
		FirstName: grpcResp.User.FirstName,
		LastName: grpcResp.User.LastName,
		Email: grpcResp.User.Email,
		AvatarURL: grpcResp.User.AvatarUrl,
		CreatedAt: grpcResp.User.CreatedAt.AsTime(),
	}, nil
}

func (s *UserService) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	grpcReq := userv1.GetUserByEmailRequest{
		Email: email,
	}

	grpcResp, err := s.client.GetUserByEmail(ctx, &grpcReq)
	if err != nil {
		return nil, err
	}

	return &domain.User{
		UserID: grpcResp.User.UserId,
		FirstName: grpcResp.User.FirstName,
		LastName: grpcResp.User.LastName,
		Email: grpcResp.User.Email,
		AvatarURL: grpcResp.User.AvatarUrl,
		CreatedAt: grpcResp.User.CreatedAt.AsTime(),
	}, nil
}

func (s *UserService) GetUserCount(ctx context.Context) (int64, error) {
	grpcReq := userv1.GetUserCountRequest{}
	
	grpcResp, err := s.client.GetUserCount(ctx, &grpcReq)
	if err != nil {
		return 0, err
	}

	return grpcResp.CountUser, nil
}

func (s *UserService) DeleteUser(ctx context.Context, userId string) (bool, error) {
	grpcReq := userv1.DeleteUserRequest{
		UserId: userId,
	}

	grpcResp, err := s.client.DeleteUser(ctx, &grpcReq)
	if err != nil {
		return false, err
	}

	return grpcResp.Success, nil
}

func (s *UserService) GetProfileById(ctx context.Context, userId string) (*domain.ProfileResponse, error) {
	grpcReq := userv1.GetProfileByIdRequest{
		UserId: userId,
	}

	grpcResp, err := s.client.GetProfileById(ctx, &grpcReq)
	if err != nil {
		return nil, err
	}

	user := domain.User{
		UserID: grpcResp.User.UserId,
		FirstName: grpcResp.User.FirstName,
		LastName: grpcResp.User.LastName,
		Email: grpcResp.User.Email,
		AvatarURL: grpcResp.User.AvatarUrl,
	}

	if grpcResp.User.CreatedAt != nil {
		user.CreatedAt = grpcResp.User.CreatedAt.AsTime()
	}

	var mentor *domain.MentorProfile
	if grpcResp.Mentor != nil {
		mentor = &domain.MentorProfile{
			UserID: grpcResp.Mentor.UserId,
			WithdrawalAddress: grpcResp.Mentor.WithdrawalAddress,
			Rating: grpcResp.Mentor.Rating,
			Description: grpcResp.Mentor.Description,
		}

		if grpcResp.Mentor.CreatedAt != nil {
			mentor.CreatedAt =  grpcResp.Mentor.CreatedAt.AsTime()
		}
	}

	var student *domain.StudentProfile
	if grpcResp.Student != nil {
		student = &domain.StudentProfile{
			UserID: grpcResp.Student.UserId,
			LearningGoals: grpcResp.Student.LearningGoals,
			PreferredLearningStyle: grpcResp.Student.PreferredLearningStyle,
		}

		if grpcResp.Student.CreatedAt != nil {
			student.CreatedAt =  grpcResp.Student.CreatedAt.AsTime()
		}
	}
	
	var teachingSkills []domain.TeachingSkill
	for _, skill := range grpcResp.TeachingSkills {
		teachingSkill := domain.TeachingSkill{
			SkillID: skill.SkillId,
			UserID: skill.UserId,
			SkillName: skill.SkillName,
			ProficiencyLevel: skill.ProficiencyLevel,
			YearsOfExperience: skill.YearsOfExperience,
		}
		if skill.CreatedAt != nil {
			teachingSkill.CreatedAt = skill.CreatedAt.AsTime()
		}

		teachingSkills = append(teachingSkills, teachingSkill)
	}

	var learningSkills []domain.LearningSkill
	for _, skill := range grpcResp.LearningSkills {
		learningSkill := domain.LearningSkill{
			SkillID: skill.SkillId,
			UserID: skill.UserId,
			SkillName: skill.SkillName,
			ProficiencyLevel: skill.ProficiencyLevel,
		}

		if skill.CreatedAt != nil {
			learningSkill.CreatedAt = skill.CreatedAt.AsTime()
		}

		learningSkills = append(learningSkills, learningSkill)
	}

	return &domain.ProfileResponse{
		User: user,
		Mentor: mentor,
		Student: student,
		LearningSkills: learningSkills,
		TeachingSkills: teachingSkills,
	}, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, userID string, updateProfileRequest domain.UpdateProfileRequest) (bool, error) {
	var learningSkills []*userv1.LearningSkillUpdate
	if updateProfileRequest.LearningSkills != nil {
		for _, skill := range updateProfileRequest.LearningSkills.LearningSkills {
			learningSkills = append(learningSkills, &userv1.LearningSkillUpdate{
				SkillName: skill.SkillName,
				ProficiencyLevel: skill.ProficiencyLevel,
			})
		}
	}

	var teachingSkills []*userv1.TeachingSkillUpdate
	if updateProfileRequest.TeachingSkills != nil {
		for _, skill := range updateProfileRequest.TeachingSkills.TeachingSkills {
			teachingSkills = append(teachingSkills, &userv1.TeachingSkillUpdate{
				SkillName: skill.SkillName,
				ProficiencyLevel: skill.ProficiencyLevel,
				YearsOfExperience: skill.YearsOfExperience,
			})
		}
	}

	var mentorUpdate *userv1.MentorUpdate
	if updateProfileRequest.MentorData != nil {
		mentorUpdate = &userv1.MentorUpdate{
			WithdrawalAddress: updateProfileRequest.MentorData.WithdrawalAddress,
			Description: updateProfileRequest.MentorData.Description,
		}
	}

	var studentUpdate *userv1.StudentUpdate
	if updateProfileRequest.StudentData != nil {
		studentUpdate = &userv1.StudentUpdate{
			LearningGoals: updateProfileRequest.StudentData.LearningGoals,
			PreferredLearningStyle: updateProfileRequest.StudentData.PreferredLearningStyle,
		}
	}
	grpcReq := userv1.UpdateProfileRequest{
		UserId: userID,
		FirstName: updateProfileRequest.FirstName,
		LastName: updateProfileRequest.LastName,
		Email: updateProfileRequest.Email,
		AvatarUrl: updateProfileRequest.AvatarURL,
		MentorData: mentorUpdate,
		StudentData: studentUpdate,
		TeachingSkills: &userv1.TeachingSkillsUpdate{
			TeachingSkills: teachingSkills,
		},
		LearningSkills: &userv1.LearningSkillsUpdate{
			LearningSkills: learningSkills,
		},
	}

	grpcResp, err := s.client.UpdateProfile(ctx, &grpcReq)
	if err != nil {
		return false, err
	}

	return grpcResp.Success, nil
}