package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/service"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type PostHandler struct {
	postService *service.PostService
}

func NewPostHandler(postService *service.PostService) *PostHandler {
	return &PostHandler{postService: postService}
}

// CreatePost создает новый пост
// @Summary Создать пост
// @Description Создает новый пост
// @Tags posts
// @Accept json
// @Produce json
// @Param request body domain.CreatePostRequest true "Данные для создания поста"
// @Security BearerAuth
// @Success 201 {object} domain.CreatePostResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 401 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts [post]
func (h *PostHandler) CreatePost(c *gin.Context) {
	var req domain.CreatePostRequest

	authorID, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	// Валидация статуса через сервис
	if req.Status != "" && !h.postService.ValidatePostStatus(req.Status) {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid post status",
		})
		return
	}

	post, err := h.postService.CreatePost(c.Request.Context(), authorID, req)
	if err != nil {
		slog.Error("Failed to create post", "error", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to create post",
		})
		return
	}

	c.JSON(http.StatusCreated, domain.CreatePostResponse{
		Post: *post,
	})
}

// GetPost возвращает пост по ID
// @Summary Получить пост по ID
// @Description Возвращает информацию о посте по его идентификатору
// @Tags posts
// @Produce json
// @Param id path string true "ID поста"
// @Success 200 {object} domain.GetPostResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 404 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts/{id} [get]
func (h *PostHandler) GetPost(c *gin.Context) {
	postID := c.Param("id")
	if postID == "" {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Post ID is required",
		})
		return
	}

	post, err := h.postService.GetPost(c.Request.Context(), postID)
	if err != nil {
		slog.Error("Failed to get post", "error", err, "post_id", postID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get post",
		})
		return
	}

	if post == nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "NOT_FOUND",
			Message: "Post not found",
		})
		return
	}

	c.JSON(http.StatusOK, domain.GetPostResponse{
		Post: *post,
	})
}

// ListPosts возвращает список постов
// @Summary Получить список постов
// @Description Возвращает список постов с фильтрацией и пагинацией
// @Tags posts
// @Produce json
// @Param page_token query string false "Токен пагинации"
// @Param page_size query int false "Размер страницы" minimum(1) maximum(100) default(20)
// @Param author_id query string false "ID автора"
// @Param status query string false "Статус поста" Enums(draft, published, archived)
// @Param tags query []string false "Теги"
// @Param search query string false "Поисковый запрос"
// @Param sort_field query string false "Поле сортировки" Enums(created_at, updated_at, title) default(created_at)
// @Param sort_order query string false "Порядок сортировки" Enums(asc, desc) default(desc)
// @Success 200 {object} domain.ListPostsResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts [get]
func (h *PostHandler) ListPosts(c *gin.Context) {
	var req domain.ListPostsRequest

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid query parameters",
			Details: err.Error(),
		})
		return
	}

	// Валидация статуса если он передан
	if req.Status != "" && !h.postService.ValidatePostStatus(req.Status) {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid post status",
		})
		return
	}

	resp, err := h.postService.ListPosts(c.Request.Context(), req)
	if err != nil {
		slog.Error("Failed to list posts", "error", err)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to list posts",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdatePost обновляет пост
// @Summary Обновить пост
// @Description Обновляет информацию о посте
// @Tags posts
// @Accept json
// @Produce json
// @Param id path string true "ID поста"
// @Param request body domain.UpdatePostRequest true "Данные для обновления"
// @Security BearerAuth
// @Success 200 {object} domain.UpdatePostResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 401 {object} domain.ErrorResponse
// @Failure 403 {object} domain.ErrorResponse
// @Failure 404 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts/{id} [put]
func (h *PostHandler) UpdatePost(c *gin.Context) {
	var req domain.UpdatePostRequest
	postID := c.Param("id")

	userID, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	// Проверка владения постом
	isOwner, err := h.postService.CheckPostOwnership(c.Request.Context(), postID, userID)
	if err != nil {
		slog.Error("Failed to check post ownership", "error", err, "post_id", postID, "user_id", userID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to update post",
		})
		return
	}

	if !isOwner {
		c.JSON(http.StatusForbidden, domain.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You don't have permission to update this post",
		})
		return
	}

	post, err := h.postService.UpdatePost(c.Request.Context(), postID, req)
	if err != nil {
		slog.Error("Failed to update post", "error", err, "post_id", postID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to update post",
		})
		return
	}

	if post == nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "NOT_FOUND",
			Message: "Post not found",
		})
		return
	}

	c.JSON(http.StatusOK, domain.UpdatePostResponse{
		Post: *post,
	})
}

// DeletePost удаляет пост
// @Summary Удалить пост
// @Description Удаляет пост по его идентификатору
// @Tags posts
// @Produce json
// @Param id path string true "ID поста"
// @Security BearerAuth
// @Success 200 {object} domain.DeletePostResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 401 {object} domain.ErrorResponse
// @Failure 403 {object} domain.ErrorResponse
// @Failure 404 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts/{id} [delete]
func (h *PostHandler) DeletePost(c *gin.Context) {
	postID := c.Param("id")
	if postID == "" {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Post ID is required",
		})
		return
	}

	userID, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return
	}

	// Проверка владения постом
	isOwner, err := h.postService.CheckPostOwnership(c.Request.Context(), postID, userID)
	if err != nil {
		slog.Error("Failed to check post ownership", "error", err, "post_id", postID, "user_id", userID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to delete post",
		})
		return
	}

	if !isOwner {
		c.JSON(http.StatusForbidden, domain.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You don't have permission to delete this post",
		})
		return
	}

	err = h.postService.DeletePost(c.Request.Context(), postID)
	if err != nil {
		slog.Error("Failed to delete post", "error", err, "post_id", postID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to delete post",
		})
		return
	}

	c.JSON(http.StatusOK, domain.DeletePostResponse{
		Success: true,
	})
}

// RatePost оценивает пост
// @Summary Оценить пост
// @Description Добавляет оценку к посту
// @Tags posts
// @Accept json
// @Produce json
// @Param id path string true "ID поста"
// @Param request body domain.RatePostRequest true "Данные для оценки"
// @Security BearerAuth
// @Success 200 {object} domain.RatePostResponse
// @Failure 400 {object} domain.ErrorResponse
// @Failure 401 {object} domain.ErrorResponse
// @Failure 404 {object} domain.ErrorResponse
// @Failure 500 {object} domain.ErrorResponse
// @Router /posts/{id}/rate [post]
func (h *PostHandler) RatePost(c *gin.Context) {
	postID := c.Param("id")
	if postID == "" {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Post ID is required",
		})
		return
	}

	userID, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return
	}

	var req domain.RatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	post, err := h.postService.RatePost(c.Request.Context(), postID, userID, req)
	if err != nil {
		slog.Error("Failed to rate post", "error", err, "post_id", postID)
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to rate post",
		})
		return
	}

	if post == nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse{
			Error:   "NOT_FOUND",
			Message: "Post not found",
		})
		return
	}

	c.JSON(http.StatusOK, domain.RatePostResponse{
		Post: *post,
	})
}