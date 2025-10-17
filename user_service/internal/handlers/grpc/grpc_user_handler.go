package grpc

import (
	"context"
	"fmt"
	"log/slog"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserProfileService interface {
	CreateUser(ctx context.Context, name string, surname string, email string) (string, error)
	GetUserById(ctx context.Context, id string) (*domain.User, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	DeleteUser(ctx context.Context, id string) error
	GetProfileById(ctx context.Context, id string) (*domain.UserProfile, error)
	UpdateProfile(ctx context.Context, profile *domain.UpdateProfile) error
}

type GRPCHandler struct {
	service UserProfileService
	userv1.UnimplementedUserServiceServer
}

func NewGRPCHandler(service UserProfileService) *GRPCHandler {
	return &GRPCHandler{service:service}
}

func (h *GRPCHandler) Register(server *grpc.Server) {
	userv1.RegisterUserServiceServer(server, h)
}

func (h *GRPCHandler) CreateUser(ctx context.Context, req *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error) {
	id, err := h.service.CreateUser(ctx, req.FirstName, req.LastName, req.Email)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp := userv1.CreateUserResponse{
		UserId: id,
	}
	return &resp, nil
}

func (h *GRPCHandler) GetUserById(ctx context.Context, req *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error) {
	user, err := h.service.GetUserById(ctx, req.UserId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp := userv1.GetUserByIdResponse{
		User: &userv1.User{
			UserId: user.Id,
			FirstName: user.Name,
			LastName: user.Surname,
			Email: user.Email,
			AvatarUrl: user.AvatarURL,
			CreatedAt: user.CreatedAt.String(),
		},
	}

	return &resp, nil
}

func (h *GRPCHandler) GetUserByEmail(ctx context.Context, req *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error) {
	user, err := h.service.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp := userv1.GetUserByEmailResponse{
		User: &userv1.User{
			UserId: user.Id,
			FirstName: user.Name,
			LastName: user.Surname,
			Email: user.Email,
			AvatarUrl: user.AvatarURL,
			CreatedAt: user.CreatedAt.String(),
		},
	}
	return &resp, nil
}

func (h *GRPCHandler) DeleteUser(ctx context.Context, req *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error) {
	err := h.service.DeleteUser(ctx, req.UserId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp := userv1.DeleteUserResponse{
		Success: true,
	}

	return &resp, nil
}

func (h *GRPCHandler) GetProfileById(ctx context.Context, req *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error) {
	profile, err := h.service.GetProfileById(ctx, req.UserId)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	fmt.Println(profile.LearningSkills)
	slog.Info("profile get success")
	respTeachingSkills := []*userv1.TeachingSkill{}

	for _, skill := range profile.TeachingSkills {
		respTeachingSkills = append(respTeachingSkills, &userv1.TeachingSkill{
			SkillId: skill.Id,
			UserId: skill.UserId,
			SkillName: skill.SkillName,
			ProficiencyLevel: skill.ProficiencyLevel,
			YearsOfExperience: int32(skill.YearsOfExperience),
		})
	}

	respLearningSkills := []*userv1.LearningSkill{}
	for _, skill := range profile.LearningSkills {
		respLearningSkills = append(respLearningSkills, &userv1.LearningSkill{
			SkillId: skill.Id,
			UserId: skill.UserId,
			SkillName: skill.SkillName,
			ProficiencyLevel: skill.ProficiencyLevel,
		})
	}

	var mentorProfile *userv1.MentorProfile
	if profile.Mentor != nil {
		mentorProfile = &userv1.MentorProfile{
			UserId: profile.Mentor.UserId,
			Rating: *profile.Mentor.Rating,
			WithdrawalAddress: profile.Mentor.Withdrawal,
			Description: profile.Mentor.Description,
		}
	}

	var studentProfile *userv1.StudentProfile
	if profile.Student != nil {
		studentProfile = &userv1.StudentProfile{
			UserId: profile.Student.UserId,
			LearningGoals: profile.Student.LearningGoals,
			PreferredLearningStyle: profile.Student.PreferredLearningStyle,
		}
	}
	resp := userv1.GetProfileByIdResponse{
		User: &userv1.User{
			UserId: profile.User.Id,
			FirstName: profile.User.Name,
			LastName: profile.User.Surname,
			Email: profile.User.Email,
			AvatarUrl: profile.User.AvatarURL,
			CreatedAt: profile.User.CreatedAt.String(),
		},
		Mentor: mentorProfile,
		Student: studentProfile,
		TeachingSkills: respTeachingSkills,
		LearningSkills: respLearningSkills,
	}

	return &resp, nil
}

func (h *GRPCHandler) UpdateProfile(ctx context.Context, req *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error) {
	var learningSkills *[]*domain.LearningSkillUpdate
	if req.LearningSkills != nil {
		skills := make([]*domain.LearningSkillUpdate, 0, len(req.LearningSkills.LearningSkills))
		for _, learningSkill := range req.LearningSkills.LearningSkills {
			skills = append(skills, &domain.LearningSkillUpdate{
				SkillName:        learningSkill.SkillName,
				ProficiencyLevel: learningSkill.ProficiencyLevel,
			})
		}
		learningSkills = &skills
	}

	var teachingSkills *[]*domain.TeachingSkillUpdate  
	if req.TeachingSkills != nil {
		skills := make([]*domain.TeachingSkillUpdate, 0, len(req.TeachingSkills.TeachingSkills))
		for _, teachingSkill := range req.TeachingSkills.TeachingSkills {
			yearsExp := teachingSkill.YearsOfExperience 
			skills = append(skills, &domain.TeachingSkillUpdate{
				SkillName:          teachingSkill.SkillName,
				ProficiencyLevel:   teachingSkill.ProficiencyLevel,
				YearsOfExperience:  &yearsExp,
			})
		}
		teachingSkills = &skills
	}

	var studentData *domain.StudentUpdate
	if req.StudentData != nil {
		studentData = &domain.StudentUpdate{
			LearningGoals: req.StudentData.LearningGoals,
			PreferredLearningStyle: req.StudentData.PreferredLearningStyle,
		}
	}

	var mentorData *domain.MentorUpdate
	if req.MentorData != nil {
		mentorData = &domain.MentorUpdate{
			Withdrawal: req.MentorData.WithdrawalAddress,
			Description: req.MentorData.Description,
		}
	}

	profile := &domain.UpdateProfile{
		Id: req.UserId,
		Email: req.Email,
		Name: req.FirstName,
		Surname: req.LastName,
		AvatarURL: req.AvatarUrl,
		Mentor: mentorData,
		Student: studentData, 
		LearningSkill: learningSkills,
		TeachingSkills: teachingSkills,
	}

	err := h.service.UpdateProfile(ctx, profile)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp := userv1.UpdateProfileResponse{
		Success: true,
	}

	return &resp, nil
}