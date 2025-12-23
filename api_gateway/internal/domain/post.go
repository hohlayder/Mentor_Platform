package domain

import (
	"time"
)

type CreatePostRequest struct {
	Title   string   `json:"title" binding:"required,min=1,max=255"`
	Content string   `json:"content" binding:"required,min=1"`
	Tags    []string `json:"tags"`
	Status  string   `json:"status" binding:"oneof=draft published archived"`
}

type CreatePostResponse struct {
	Post Post `json:"post"`
}

type GetPostResponse struct {
	Post Post `json:"post"`
}

type Rating struct {
	ID        string    `json:"id"`         
	PostID    string    `json:"post_id"`    
	UserID    string    `json:"user_id"`     
	Rate      int32     `json:"rate"`      
	Comment   string    `json:"comment,omitempty"` 
	CreatedAt time.Time `json:"created_at"` 
}

type ListPostsRequest struct {
	PageToken  string   `form:"page_token"`
	PageSize   int32    `form:"page_size" binding:"min=1,max=100"`
	AuthorID   string   `form:"author_id"`
	Status     string   `form:"status" binding:"omitempty,oneof=draft published archived"`
	Tags       []string `form:"tags"`
	SearchQuery string  `form:"search"`
	SortField  string   `form:"sort_field" binding:"omitempty,oneof=created_at updated_at title"`
	SortOrder  string   `form:"sort_order" binding:"omitempty,oneof=asc desc"`
}

type ListPostsResponse struct {
	Posts         []Post `json:"posts"`
	NextPageToken string `json:"next_page_token,omitempty"`
	TotalCount    int32  `json:"total_count"`
}

type UpdatePostRequest struct {
	Post PostUpdate `json:"post" binding:"required"`
}

type UpdatePostResponse struct {
	Post Post `json:"post"`
}

type PostUpdate struct {
	ID      string    `json:"id" binding:"required"`
	Title   *string   `json:"title,omitempty"`
	Content *string   `json:"content,omitempty"`
	Tags    *[]string `json:"tags,omitempty"`
	Status  *string   `json:"status,omitempty" binding:"omitempty,oneof=draft published archived"`
}

type DeletePostResponse struct {
	Success bool `json:"success"`
}

type RatePostRequest struct {
	UserID  string  `json:"user_id" binding:"required"`
	Rate    int32   `json:"rate" binding:"required,min=1,max=5"`
	Comment *string `json:"comment,omitempty"`
}

type RatePostResponse struct {
	Post Post `json:"post"`
}

// Основные модели

type Post struct {
	ID            string    `json:"id"`
	AuthorID      string    `json:"author_id"`
	Title         string    `json:"title"`
	Content       string    `json:"content"`
	Tags          []string  `json:"tags"`
	Status        string    `json:"status"`
	AverageRating float64   `json:"average_rating"`
	RatingsCount  int32     `json:"ratings_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type GetPostRatingsRequest struct {
	PageToken string `form:"page_token"`               // Токен пагинации
	PageSize  int32  `form:"page_size" binding:"min=1,max=100"` // Размер страницы
}

// GetPostRatingsResponse - ответ со списком отзывов
type GetPostRatingsResponse struct {
	Ratings       []Rating `json:"ratings"`              // Список оценок
	NextPageToken string   `json:"next_page_token,omitempty"` // Токен следующей страницы
	TotalCount    int32    `json:"total_count"`          // Общее количество отзывов
	AverageRating float32  `json:"average_rating"`       // Средний рейтинг
	RatingsCount  int32    `json:"ratings_count"`        // Количество оценок
}

// GetUserRatingResponse - ответ с оценкой конкретного пользователя
type GetUserRatingResponse struct {
	Rating *Rating `json:"rating,omitempty"` // Оценка пользователя (nil если нет оценки)
}

