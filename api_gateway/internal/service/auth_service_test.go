package service

import (
	"context"
	"errors"
	"testing"

	authv1 "github.com/Sergey-1214/contracts_mentors/auth/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAuthClient struct {
	mock.Mock
}

func (m *MockAuthClient) Register(ctx context.Context, in *authv1.RegisterRequest) (*authv1.RegisterResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authv1.RegisterResponse), args.Error(1)
}

func (m *MockAuthClient) Login(ctx context.Context, in *authv1.LoginRequest) (*authv1.LoginResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authv1.LoginResponse), args.Error(1)
}

func (m *MockAuthClient) Refresh(ctx context.Context, in *authv1.RefreshRequest) (*authv1.RefreshResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authv1.RefreshResponse), args.Error(1)
}

func (m *MockAuthClient) Logout(ctx context.Context, in *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authv1.LogoutResponse), args.Error(1)
}
func TestAuthService_Register(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		firstName      string
		lastName       string
		email          string
		password       string
		mockResponse   *authv1.RegisterResponse
		mockError      error
		expectedUserID string
		expectedError  string
	}{
		{
			name:      "success",
			firstName: "John",
			lastName:  "Doe",
			email:     "john.doe@example.com",
			password:  "password123",
			mockResponse: &authv1.RegisterResponse{
				Id: "user-123",
			},
			mockError:      nil,
			expectedUserID: "user-123",
			expectedError:  "",
		},
		{
			name:           "client error",
			firstName:      "John",
			lastName:       "Doe",
			email:          "john.doe@example.com",
			password:       "password123",
			mockResponse:   nil,
			mockError:      errors.New("grpc error"),
			expectedUserID: "",
			expectedError:  "failed to register user: grpc error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockAuthClient)
			authService := NewAuthService(mockClient)

			mockClient.On("Register", mock.Anything, mock.Anything).
				Return(tt.mockResponse, tt.mockError)

			userID, err := authService.Register(ctx, tt.firstName, tt.lastName, tt.email, tt.password)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedUserID, userID)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestAuthService_Login(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name          string
		email         string
		password      string
		mockResponse  *authv1.LoginResponse
		mockError     error
		expectedToken *domain.TokenPair
		expectedError string
	}{
		{
			name:     "success",
			email:    "john.doe@example.com",
			password: "password123",
			mockResponse: &authv1.LoginResponse{
				AccessToken:  "access-token-123",
				RefreshToken: "refresh-token-456",
				ExpiresIn:    3600,
			},
			mockError: nil,
			expectedToken: &domain.TokenPair{
				AccessToken:  "access-token-123",
				RefreshToken: "refresh-token-456",
				ExpiresIn:    3600,
			},
			expectedError: "",
		},
		{
			name:          "client error",
			email:         "john.doe@example.com",
			password:      "password123",
			mockResponse:  nil,
			mockError:     errors.New("invalid credentials"),
			expectedToken: nil,
			expectedError: "failed to login user: invalid credentials",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockAuthClient)
			authService := NewAuthService(mockClient)

			mockClient.On("Login", mock.Anything, mock.Anything).
				Return(tt.mockResponse, tt.mockError)

			tokens, err := authService.Login(ctx, tt.email, tt.password)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedToken, tokens)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestAuthService_RefreshToken(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		refreshToken   string
		mockResponse   *authv1.RefreshResponse
		mockError      error
		expectedToken  *domain.TokenPair
		expectedError  string
	}{
		{
			name:         "success",
			refreshToken: "refresh-token-123",
			mockResponse: &authv1.RefreshResponse{
				AccessToken:  "new-access-token-456",
				RefreshToken: "new-refresh-token-789",
				ExpiresIn:    3600,
			},
			mockError: nil,
			expectedToken: &domain.TokenPair{
				AccessToken:  "new-access-token-456",
				RefreshToken: "new-refresh-token-789",
				ExpiresIn:    3600,
			},
			expectedError: "",
		},
		{
			name:           "client error",
			refreshToken:   "invalid-refresh-token",
			mockResponse:   nil,
			mockError:      errors.New("token expired"),
			expectedToken:  nil,
			expectedError:  "failed to refresh token: token expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockAuthClient)
			authService := NewAuthService(mockClient)

			// Настраиваем мок
			mockClient.On("Refresh", mock.Anything, mock.Anything).
				Return(tt.mockResponse, tt.mockError)

			tokens, err := authService.RefreshToken(ctx, tt.refreshToken)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedToken, tokens)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestAuthService_Logout(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name            string
		refreshToken    string
		mockResponse    *authv1.LogoutResponse
		mockError       error
		expectedSuccess bool
		expectedError   string
	}{
		{
			name:         "success",
			refreshToken: "refresh-token-123",
			mockResponse: &authv1.LogoutResponse{
				Success: true,
			},
			mockError:       nil,
			expectedSuccess: true,
			expectedError:   "",
		},
		{
			name:            "client error",
			refreshToken:    "invalid-token",
			mockResponse:    nil,
			mockError:       errors.New("logout failed"),
			expectedSuccess: false,
			expectedError:   "failed to logout: logout failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockAuthClient)
			authService := NewAuthService(mockClient)

			mockClient.On("Logout", mock.Anything, mock.Anything).
				Return(tt.mockResponse, tt.mockError)

			success, err := authService.Logout(ctx, tt.refreshToken)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.False(t, success)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedSuccess, success)
			}

			mockClient.AssertExpectations(t)
		})
	}
}