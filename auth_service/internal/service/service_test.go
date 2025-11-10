package service

import (
	"context"
	"errors"
	"testing"
	"time"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/domain"

	jwt "github.com/hohlayder/Mentor_Platform/auth_service/internal/auth/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc"
	"golang.org/x/crypto/bcrypt"
)

// Mock репозиториев и клиентов
type MockAuthRepository struct {
	mock.Mock
}

func (m *MockAuthRepository) Register(ctx context.Context, id string, hashPassword string) error {
	args := m.Called(ctx, id, hashPassword)
	return args.Error(0)
}

func (m *MockAuthRepository) GetCredentialByUserId(ctx context.Context, userId string) (*domain.Credential, error) {
	args := m.Called(ctx, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Credential), args.Error(1)
}

type MockTokenRepository struct {
	mock.Mock
}

func (m *MockTokenRepository) CreateRefreshToken(ctx context.Context, userId string, hashRefreshToken string, expiresAt time.Time) error {
	args := m.Called(ctx, userId, hashRefreshToken, expiresAt)
	return args.Error(0)
}

func (m *MockTokenRepository) GetRefreshToken(ctx context.Context, hashToken string) (string, error) {
	args := m.Called(ctx, hashToken)
	return args.String(0), args.Error(1)
}

func (m *MockTokenRepository) RevokedToken(ctx context.Context, hashToken string) error {
	args := m.Called(ctx, hashToken)
	return args.Error(0)
}

func (m *MockTokenRepository) DeleteRefreshToken(ctx context.Context, hashToken string) error {
	args := m.Called(ctx, hashToken)
	return args.Error(0)
}

type MockUserClient struct {
	mock.Mock
}

func (m *MockUserClient) CreateUser(ctx context.Context, in *userv1.CreateUserRequest, opts ...grpc.CallOption) (*userv1.CreateUserResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.CreateUserResponse), args.Error(1)
}

func (m *MockUserClient) GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest, opts ...grpc.CallOption) (*userv1.GetUserByIdResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetUserByIdResponse), args.Error(1)
}

func (m *MockUserClient) GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest, opts ...grpc.CallOption) (*userv1.GetUserByEmailResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetUserByEmailResponse), args.Error(1)
}

func (m *MockUserClient) DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest, opts ...grpc.CallOption) (*userv1.DeleteUserResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.DeleteUserResponse), args.Error(1)
}

func (m *MockUserClient) GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest, opts ...grpc.CallOption) (*userv1.GetProfileByIdResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetProfileByIdResponse), args.Error(1)
}

func (m *MockUserClient) UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest, opts ...grpc.CallOption) (*userv1.UpdateProfileResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.UpdateProfileResponse), args.Error(1)
}

func (m *MockUserClient) UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest, opts ...grpc.CallOption) (*userv1.UploadAvatarResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.UploadAvatarResponse), args.Error(1)
}

func (m *MockUserClient) DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest, opts ...grpc.CallOption) (*userv1.DeleteAvatarResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.DeleteAvatarResponse), args.Error(1)
}

type MockTokenManager struct {
	mock.Mock
}

func (m *MockTokenManager) GenerateTokenPair(userID string) (*jwt.TokenPair, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jwt.TokenPair), args.Error(1)
}

func (m *MockTokenManager) RefreshTokens(refreshToken string) (*jwt.TokenPair, error) {
	args := m.Called(refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jwt.TokenPair), args.Error(1)
}

func TestAuthService_Register(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockAuthRepository, *MockUserClient, *MockTokenManager)
		nameInput     string
		surnameInput  string
		emailInput    string
		passwordInput string
		expectedID    string
		expectedError string
	}{
		{
			name: "successful registration",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("CreateUser", mock.Anything, &userv1.CreateUserRequest{
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john@example.com",
				}).Return(&userv1.CreateUserResponse{UserId: "user-123"}, nil)

				authRepo.On("Register", mock.Anything, "user-123", mock.AnythingOfType("string")).
					Return(nil)
			},
			nameInput:     "John",
			surnameInput:  "Doe",
			emailInput:    "john@example.com",
			passwordInput: "password123",
			expectedID:    "user-123",
			expectedError: "",
		},
		{
			name: "user creation fails",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("CreateUser", mock.Anything, mock.Anything).
					Return(nil, errors.New("user creation failed"))
			},
			nameInput:     "John",
			surnameInput:  "Doe",
			emailInput:    "john@example.com",
			passwordInput: "password123",
			expectedID:    "",
			expectedError: "failed to create user: user creation failed",
		},
		{
			name: "auth repo registration fails - rollback successful",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("CreateUser", mock.Anything, mock.Anything).
					Return(&userv1.CreateUserResponse{UserId: "user-123"}, nil)

				authRepo.On("Register", mock.Anything, "user-123", mock.AnythingOfType("string")).
					Return(errors.New("database error"))

				userClient.On("DeleteUser", mock.Anything, &userv1.DeleteUserRequest{UserId: "user-123"}).
					Return(&userv1.DeleteUserResponse{}, nil)
			},
			nameInput:     "John",
			surnameInput:  "Doe",
			emailInput:    "john@example.com",
			passwordInput: "password123",
			expectedID:    "",
			expectedError: "failed to register user: database error",
		},
		{
			name: "auth repo registration fails - rollback fails",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("CreateUser", mock.Anything, mock.Anything).
					Return(&userv1.CreateUserResponse{UserId: "user-123"}, nil)

				authRepo.On("Register", mock.Anything, "user-123", mock.AnythingOfType("string")).
					Return(errors.New("database error"))

				userClient.On("DeleteUser", mock.Anything, &userv1.DeleteUserRequest{UserId: "user-123"}).
					Return(nil, errors.New("rollback failed"))
			},
			nameInput:     "John",
			surnameInput:  "Doe",
			emailInput:    "john@example.com",
			passwordInput: "password123",
			expectedID:    "",
			expectedError: "failed to delete user when rollback user create: rollback failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authRepo := new(MockAuthRepository)
			tokenRepo := new(MockTokenRepository)
			userClient := new(MockUserClient)
			tokenManager := new(MockTokenManager)

			tt.setupMocks(authRepo, userClient, tokenManager)

			service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

			userID, err := service.Register(context.Background(), tt.nameInput, tt.surnameInput, tt.emailInput, tt.passwordInput)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Empty(t, userID)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedID, userID)
			}

			authRepo.AssertExpectations(t)
			userClient.AssertExpectations(t)
		})
	}
}

func TestAuthService_Login(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockAuthRepository, *MockUserClient, *MockTokenManager)
		email         string
		password      string
		expectedToken *jwt.TokenPair
		expectedError string
	}{
		{
			name: "successful login",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("GetUserByEmail", mock.Anything, &userv1.GetUserByEmailRequest{Email: "test@example.com"}).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(&domain.Credential{HashPassword: string(hashedPassword)}, nil)

				tokenManager.On("GenerateTokenPair", "user-123").
					Return(&jwt.TokenPair{
						AccessToken:  "access-token",
						RefreshToken: "refresh-token",
						ExpiresIn:    3600,
					}, nil)
			},
			email:    "test@example.com",
			password: "password123",
			expectedToken: &jwt.TokenPair{
				AccessToken:  "access-token",
				RefreshToken: "refresh-token",
				ExpiresIn:    3600,
			},
			expectedError: "",
		},
		{
			name: "user not found",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("GetUserByEmail", mock.Anything, mock.Anything).
					Return(nil, errors.New("user not found"))
			},
			email:         "nonexistent@example.com",
			password:      "password123",
			expectedToken: nil,
			expectedError: "failed to validate credential: failed to get user: user not found",
		},
		{
			name: "invalid password",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("GetUserByEmail", mock.Anything, &userv1.GetUserByEmailRequest{Email: "test@example.com"}).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)
				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(&domain.Credential{HashPassword: string(hashedPassword)}, nil)
			},
			email:         "test@example.com",
			password:      "wrongpassword",
			expectedToken: nil,
			expectedError: "failed to validate credential: invalid password",
		},
		{
			name: "credential not found",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("GetUserByEmail", mock.Anything, mock.Anything).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(nil, errors.New("credential not found"))
			},
			email:         "test@example.com",
			password:      "password123",
			expectedToken: nil,
			expectedError: "failed to validate credential: credential not found",
		},
		{
			name: "token generation fails",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient, tokenManager *MockTokenManager) {
				userClient.On("GetUserByEmail", mock.Anything, mock.Anything).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(&domain.Credential{HashPassword: string(hashedPassword)}, nil)

				tokenManager.On("GenerateTokenPair", "user-123").
					Return(nil, errors.New("token generation failed"))
			},
			email:         "test@example.com",
			password:      "password123",
			expectedToken: nil,
			expectedError: "failed to generate token pair: token generation failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authRepo := new(MockAuthRepository)
			tokenRepo := new(MockTokenRepository)
			userClient := new(MockUserClient)
			tokenManager := new(MockTokenManager)

			tt.setupMocks(authRepo, userClient, tokenManager)

			service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

			tokens, err := service.Login(context.Background(), tt.email, tt.password)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, tokens)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedToken, tokens)
			}

			authRepo.AssertExpectations(t)
			userClient.AssertExpectations(t)
			tokenManager.AssertExpectations(t)
		})
	}
}

func TestAuthService_RefreshToken(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockTokenManager)
		refreshToken  string
		expectedToken *jwt.TokenPair
		expectedError string
	}{
		{
			name: "successful token refresh",
			setupMocks: func(tokenManager *MockTokenManager) {
				tokenManager.On("RefreshTokens", "valid-refresh-token").
					Return(&jwt.TokenPair{
						AccessToken:  "new-access-token",
						RefreshToken: "new-refresh-token",
						ExpiresIn:    3600,
					}, nil)
			},
			refreshToken: "valid-refresh-token",
			expectedToken: &jwt.TokenPair{
				AccessToken:  "new-access-token",
				RefreshToken: "new-refresh-token",
				ExpiresIn:    3600,
			},
			expectedError: "",
		},
		{
			name: "token refresh fails",
			setupMocks: func(tokenManager *MockTokenManager) {
				tokenManager.On("RefreshTokens", "invalid-token").
					Return(nil, errors.New("invalid refresh token"))
			},
			refreshToken:  "invalid-token",
			expectedToken: nil,
			expectedError: "invalid refresh token",
		},
		{
			name: "empty refresh token",
			setupMocks: func(tokenManager *MockTokenManager) {
				tokenManager.On("RefreshTokens", "").
					Return(nil, errors.New("empty refresh token"))
			},
			refreshToken:  "",
			expectedToken: nil,
			expectedError: "empty refresh token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authRepo := new(MockAuthRepository)
			tokenRepo := new(MockTokenRepository)
			userClient := new(MockUserClient)
			tokenManager := new(MockTokenManager)

			tt.setupMocks(tokenManager)

			service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

			tokens, err := service.RefreshToken(context.Background(), tt.refreshToken)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, tokens)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedToken, tokens)
			}

			tokenManager.AssertExpectations(t)
		})
	}
}

func TestAuthService_Logout(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockTokenRepository)
		refreshToken  string
		expectedError string
	}{
		{
			name: "successful logout",
			setupMocks: func(tokenRepo *MockTokenRepository) {
				tokenRepo.On("RevokedToken", mock.Anything, mock.AnythingOfType("string")).
					Return(nil)
			},
			refreshToken:  "refresh-token",
			expectedError: "",
		},
		{
			name: "logout fails",
			setupMocks: func(tokenRepo *MockTokenRepository) {
				tokenRepo.On("RevokedToken", mock.Anything, mock.AnythingOfType("string")).
					Return(errors.New("database error"))
			},
			refreshToken:  "refresh-token",
			expectedError: "failed revoked token: database error",
		},
		{
			name: "empty refresh token",
			setupMocks: func(tokenRepo *MockTokenRepository) {
				tokenRepo.On("RevokedToken", mock.Anything, mock.AnythingOfType("string")).
					Return(errors.New("empty token"))
			},
			refreshToken:  "",
			expectedError: "failed revoked token: empty token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authRepo := new(MockAuthRepository)
			tokenRepo := new(MockTokenRepository)
			userClient := new(MockUserClient)
			tokenManager := new(MockTokenManager)

			tt.setupMocks(tokenRepo)

			service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

			err := service.Logout(context.Background(), tt.refreshToken)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}

			tokenRepo.AssertExpectations(t)
		})
	}
}

func TestAuthService_ValidateCredential(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockAuthRepository, *MockUserClient)
		email         string
		password      string
		expectedID    string
		expectedError string
	}{
		{
			name: "successful validation",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient) {
				userClient.On("GetUserByEmail", mock.Anything, &userv1.GetUserByEmailRequest{Email: "test@example.com"}).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(&domain.Credential{HashPassword: string(hashedPassword)}, nil)
			},
			email:         "test@example.com",
			password:      "password123",
			expectedID:    "user-123",
			expectedError: "",
		},
		{
			name: "user not found",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient) {
				userClient.On("GetUserByEmail", mock.Anything, mock.Anything).
					Return(nil, errors.New("user not found"))
			},
			email:         "nonexistent@example.com",
			password:      "password123",
			expectedID:    "",
			expectedError: "failed to get user: user not found",
		},
		{
			name: "credential not found",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient) {
				userClient.On("GetUserByEmail", mock.Anything, mock.Anything).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(nil, errors.New("credential not found"))
			},
			email:         "test@example.com",
			password:      "password123",
			expectedID:    "",
			expectedError: "credential not found",
		},
		{
			name: "invalid password",
			setupMocks: func(authRepo *MockAuthRepository, userClient *MockUserClient) {
				userClient.On("GetUserByEmail", mock.Anything, &userv1.GetUserByEmailRequest{Email: "test@example.com"}).
					Return(&userv1.GetUserByEmailResponse{
						User: &userv1.User{UserId: "user-123"},
					}, nil)

				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)
				authRepo.On("GetCredentialByUserId", mock.Anything, "user-123").
					Return(&domain.Credential{HashPassword: string(hashedPassword)}, nil)
			},
			email:         "test@example.com",
			password:      "wrongpassword",
			expectedID:    "",
			expectedError: "invalid password",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authRepo := new(MockAuthRepository)
			tokenRepo := new(MockTokenRepository)
			userClient := new(MockUserClient)
			tokenManager := new(MockTokenManager)

			tt.setupMocks(authRepo, userClient)

			service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

			userID, err := service.ValidateCredential(tt.email, tt.password)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Empty(t, userID)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedID, userID)
			}

			authRepo.AssertExpectations(t)
			userClient.AssertExpectations(t)
		})
	}
}

func TestNewAuthService(t *testing.T) {
	t.Run("successful service creation", func(t *testing.T) {
		authRepo := new(MockAuthRepository)
		tokenRepo := new(MockTokenRepository)
		userClient := new(MockUserClient)
		tokenManager := new(MockTokenManager)

		service := NewAuthService(authRepo, tokenRepo, userClient, tokenManager)

		assert.NotNil(t, service)
		assert.Equal(t, authRepo, service.authRepo)
		assert.Equal(t, tokenRepo, service.tokenRepo)
		assert.Equal(t, userClient, service.userClient)
		assert.Equal(t, tokenManager, service.tokenManager)
	})
}
