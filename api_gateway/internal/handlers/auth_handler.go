package handlers

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type AuthService interface {
	Register(ctx context.Context, name string, surname string, email string, password string) (string, error)
	Login(ctx context.Context, email string, password string) (*domain.TokenPair, error)
	RefreshToken(ctx context.Context, refreshToken string) (*domain.TokenPair, error)
	Logout(ctx context.Context, refreshToken string) (bool, error)
}

type AuthHandler struct {
	service AuthService
}

func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}


// Register godoc
// @Summary Регистрация пользователя
// @Description Создание нового аккаунта пользователя
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.RegisterRequest true "Данные для регистрации"
// @Success 201 {object} domain.RegisterResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req domain.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Error("Failed to bind register request", "error", err)
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if err := validateRegisterRequest(&req); err != nil {
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	userID, err := h.service.Register(c.Request.Context(), req.Name, req.Surname, req.Email, req.Password)
	if err != nil {
		slog.Error("Failed to register user", "error", err)
		c.JSON(500, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to register user",
			Details: "Internal server error",
		})
		return
	}

	resp := domain.RegisterResponse{
		ID: userID,
	}

	c.JSON(201, resp)
}

// Login godoc
// @Summary Вход в систему
// @Description Аутентификация пользователя и получение токенов
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.LoginRequest true "Учетные данные"
// @Success 200 {object} domain.LoginResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Error("Failed to bind login request", "error", err)
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	tokens, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		slog.Error("Failed to login", "error", err)
		c.JSON(401, utils.ErrorResponse{
			Error:   "UNAUTHORIZED",
			Message: "Invalid credentials",
			Details: "Internal server error",
		})
		return
	}

	resp := domain.LoginResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
	}

	c.JSON(200, resp)
}

// RefreshToken godoc
// @Summary Обновление токена
// @Description Получение новой пары access/refresh токенов
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.RefreshRequest true "Refresh token"
// @Success 200 {object} domain.RefreshResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req domain.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Error("Failed to bind refresh request", "error", err)
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if req.RefreshToken == "" {
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Refresh token is required",
			Details: "",
		})
		return
	}

	tokens, err := h.service.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		errorMsg := err.Error()
		slog.Error("Failed to refresh token", "error", err)
		
		switch {
		case strings.Contains(errorMsg, "invalid"):
			c.JSON(401, utils.ErrorResponse{
				Error:   "UNAUTHORIZED",
				Message: "Invalid token",
			})
		case strings.Contains(errorMsg, "expired"):
			c.JSON(401, utils.ErrorResponse{
				Error:   "UNAUTHORIZED",
				Message: "Token expired",
				Details: "Internal server error",
			})
		case strings.Contains(errorMsg, "empty"):
			c.JSON(400, utils.ErrorResponse{
				Error:   "VALIDATION_ERROR",
				Message: "Empty token",
				Details: "Internal server error",
			})
		default:
			c.JSON(500, utils.ErrorResponse{
				Error:   "INTERNAL_ERROR",
				Message: "Failed to refresh token",
				Details: "Internal server error",
			})
		}
		return
	}

	resp := domain.RefreshResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
	}

	c.JSON(200, resp)
}

// Logout godoc
// @Summary Выход из системы
// @Description Инвалидация refresh токена
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.LogoutRequest true "Refresh token"
// @Success 200 {object} domain.LogoutResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	var req domain.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Error("Failed to bind logout request", "error", err)
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if req.RefreshToken == "" {
		c.JSON(400, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Refresh token is required",
			Details: "",
		})
		return
	}

	success, err := h.service.Logout(c.Request.Context(), req.RefreshToken)
	if err != nil {
		slog.Error("Failed to logout", "error", err)
		c.JSON(500, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to logout",
			Details: "Internal server error",
		})
		return
	}

	resp := domain.LogoutResponse{
		Success: success,
	}

	c.JSON(200, resp)
}

// Валидация запросов
func validateRegisterRequest(req *domain.RegisterRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(req.Surname) == "" {
		return fmt.Errorf("surname is required")
	}
	if strings.TrimSpace(req.Email) == "" {
		return fmt.Errorf("email is required")
	}
	if strings.TrimSpace(req.Password) == "" {
		return fmt.Errorf("password is required")
	}
	if len(req.Password) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}
	return nil
}

