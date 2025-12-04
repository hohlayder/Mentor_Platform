package service

import (
	"context"
	"github.com/hohlayder/Mentor_Platform/contracts_mentors/post/v1"
	"github.com/hohlayder/Mentor_Platform/post_service/internal/repository"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// PostService - структура для обработки логики работы с постами
type PostService struct {
	postRepository repository.PostRepository
}

// NewPostService - конструктор для PostService
func NewPostService(postRepo repository.PostRepository) *PostService {
	return &PostService{postRepository: postRepo}
}

// CreatePost - метод для создания поста
func (s *PostService) CreatePost(ctx context.Context, req *v1.CreatePostRequest) (*v1.CreatePostResponse, error) {
	post := &repository.Post{
		AuthorId: req.GetAuthorId(),
		Title:    req.GetTitle(),
		Content:  req.GetContent(),
		Tags:     req.GetTags(),
		Status:   req.GetStatus(),
	}

	// Сохраняем пост в репозитории
	err := s.postRepository.Save(ctx, post)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to create post: %v", err)
	}

	// Возвращаем ответ с постом
	return &v1.CreatePostResponse{
		Post: postToProto(post),
	}, nil
}

// Преобразование Post в PostProto
func postToProto(post *repository.Post) *v1.Post {
	return &v1.Post{
		Id:        post.ID,
		AuthorId:  post.AuthorId,
		Title:     post.Title,
		Content:   post.Content,
		Tags:      post.Tags,
		Status:    post.Status,
		CreatedAt: post.CreatedAt,
		UpdatedAt: post.UpdatedAt,
	}
}
