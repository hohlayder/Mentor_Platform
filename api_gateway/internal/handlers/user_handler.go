package handlers

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type UserService interface {
    CreateUser(ctx context.Context, req *domain.CreateUserRequest) (*domain.CreateUserResponse, error)
    GetUserByID(ctx context.Context, userID string) (*domain.User, error)
    GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
    DeleteUser(ctx context.Context, userID string) (bool, error)

    GetProfileById(ctx context.Context, userID string) (*domain.ProfileResponse, error)
    UpdateProfile(ctx context.Context, userID string, req domain.UpdateProfileRequest) (bool, error)
}

type UserHandler struct {
    userService UserService
}

func NewUserHandler(userService UserService) *UserHandler {
    return &UserHandler{
        userService: userService,
    }
}

// GetUserByID возвращает пользователя по ID
// @Summary Получить пользователя по ID
// @Description Возвращает информацию о пользователе по его идентификатору
// @Tags users
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} domain.User
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /users/{id} [get]
func (h *UserHandler) GetUserByID(c *gin.Context) {
    userID := c.Param("id")
    
    user, err := h.userService.GetUserByID(c.Request.Context(), userID)
    if err != nil {
        handleGRPCError(c, err)
        return
    }
    
    c.JSON(http.StatusOK, user)
}

// GetUserByEmail возвращает пользователя по email
// @Summary Получить пользователя по email
// @Description Возвращает информацию о пользователе по его email
// @Tags users
// @Produce json
// @Param email path string true "Email пользователя"
// @Success 200 {object} domain.User
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /users/email/{email} [get]
func (h *UserHandler) GetUserByEmail(c *gin.Context) {
    email := c.Param("email")
    
    user, err := h.userService.GetUserByEmail(c.Request.Context(), email)
    if err != nil {
        handleGRPCError(c, err)
        return
    }
    
    c.JSON(http.StatusOK, user)
}

// DeleteUser удаляет пользователя
// @Summary Удалить пользователя
// @Description Удаляет пользователя и все связанные данные
// @Tags users
// @Param id path string true "User ID"
// @Security BearerAuth
// @Success 204
// @Failure 401 {object} utils.ErrorResponse
// @Failure 403 {object} utils.ErrorResponse
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(c *gin.Context) {
    userIDForDelete := c.Param("id")
    userId, ok := utils.GetUserIdFromContext(c)
    if !ok {
        return
    }

    if userId != userIDForDelete {
        c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error: "FORBIDDEN_ERROR",
			Message: "It is not possible to delete another user",
		})
        return
    }

    success, err := h.userService.DeleteUser(c.Request.Context(), userIDForDelete)
    if err != nil {
        handleGRPCError(c, err)
        return
    }
    
    if success {
        c.Status(http.StatusNoContent)
    } else {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error:   "INTERNAL_ERROR",
            Message: "Failed to delete user",
        })
    }
}

// GetProfile возвращает полный профиль пользователя
// @Summary Получить профиль
// @Description Возвращает полную информацию о профиле пользователя включая менторские/студенческие данные
// @Tags profiles
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} domain.ProfileResponse
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /profiles/{id} [get]
func (h *UserHandler) GetProfile(c *gin.Context) {
    userID := c.Param("id")
    
    profile, err := h.userService.GetProfileById(c.Request.Context(), userID)
    if err != nil {
        handleGRPCError(c, err)
        return
    }
    
    c.JSON(http.StatusOK, profile)
}

// UpdateProfile обновляет профиль пользователя
// @Summary Обновить профиль
// @Description Обновляет данные профиля пользователя. Автоматически создает mentor/student записи при необходимости.
// @Tags profiles
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param request body domain.UpdateProfileRequest true "Данные для обновления"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 403 {object} utils.ErrorResponse
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /profiles/{id} [put]
func (h *UserHandler) UpdateProfile(c *gin.Context) {
    var req domain.UpdateProfileRequest
    userIdForUpdate := c.Param("id")
    userId, ok := utils.GetUserIdFromContext(c)
    if !ok {
        return
    }

    if userId != userIdForUpdate {
        c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error: "FORBIDDEN_ERROR",
			Message: "It is not possible to update another profile",
		})
        return
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error:   "VALIDATION_ERROR",
            Message: "Invalid input data",
            Details: err.Error(),
        })
        return
    }
    
    success, err := h.userService.UpdateProfile(c.Request.Context(), userIdForUpdate, req)
    if err != nil {
        handleGRPCError(c, err)
        return
    }
    
    c.JSON(http.StatusOK, utils.SuccessResponse{
        Success: success,
    })
}


func handleGRPCError(c *gin.Context, err error) {
    slog.Error(err.Error())
    c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
        Error:   "INTERNAL_ERROR",
        Message: "Internal server error",
    })
}