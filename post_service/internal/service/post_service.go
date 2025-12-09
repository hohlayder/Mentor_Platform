package service

import (
	"context"
	"errors"
	"strconv"

	postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"github.com/hohlayder/Mentor_Platform/post_service/internal/repository"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// PostService - структура для обработки логики работы с постами.
type PostService struct {
	postsv1.UnimplementedPostServiceServer
	postRepository   repository.PostRepository
	ratingRepository repository.RatingRepository
}

// NewPostService - конструктор для PostService.
func NewPostService(postRepo repository.PostRepository, ratingRepo repository.RatingRepository) *PostService {
	return &PostService{
		postRepository:   postRepo,
		ratingRepository: ratingRepo,
	}
}

// ----------------- Реальные методы -----------------

// CreatePost - метод для создания поста.
func (s *PostService) CreatePost(ctx context.Context, req *postsv1.CreatePostRequest) (*postsv1.CreatePostResponse, error) {
	post := &repository.Post{
		AuthorId: req.GetAuthorId(),
		Title:    req.GetTitle(),
		Content:  req.GetContent(),
		Tags:     req.GetTags(),
		Status:   req.GetStatus().String(), // enum -> string
	}

	if err := s.postRepository.Save(ctx, post); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create post: %v", err)
	}

	respPost := postToProto(post)
	// Новый пост ещё не имеет рейтингов.
	respPost.AverageRating = 0
	respPost.RatingsCount = 0

	return &postsv1.CreatePostResponse{
		Post: respPost,
	}, nil
}

// GetPost - метод для получения поста по ID.
func (s *PostService) GetPost(ctx context.Context, req *postsv1.GetPostRequest) (*postsv1.GetPostResponse, error) {
	id := req.GetId()
	if id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	post, err := s.postRepository.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

	avg, count, err := s.ratingRepository.GetAggregatedRating(ctx, id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get rating: %v", err)
	}

	respPost := postToProto(post)
	respPost.AverageRating = avg
	respPost.RatingsCount = count

	return &postsv1.GetPostResponse{
		Post: respPost,
	}, nil
}

// ListPosts - метод для получения списка постов с фильтрами и пагинацией.
func (s *PostService) ListPosts(ctx context.Context, req *postsv1.ListPostsRequest) (*postsv1.ListPostsResponse, error) {
	pageSize := req.GetPageSize()
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var offset int
	if token := req.GetPageToken(); token != "" {
		val, err := strconv.Atoi(token)
		if err != nil || val < 0 {
			return nil, status.Error(codes.InvalidArgument, "invalid page_token")
		}
		offset = val
	}

	// Маппинг enums в строки, понятные репозиторию.
	sortField := ""
	switch req.GetSortField() {
	case postsv1.SortField_CREATED_AT:
		sortField = "created_at"
	case postsv1.SortField_UPDATED_AT:
		sortField = "updated_at"
	case postsv1.SortField_TITLE:
		sortField = "title"
	default:
		sortField = "created_at"
	}

	sortOrder := "DESC"
	if req.GetSortOrder() == postsv1.SortOrder_ASC {
		sortOrder = "ASC"
	}

	var statusStr string
	if req.GetStatus() != postsv1.PostStatus(0) {
		statusStr = req.GetStatus().String()
	}

	params := repository.ListParams{
		Limit:       int(pageSize),
		Offset:      offset,
		AuthorID:    req.GetAuthorId(),
		Status:      statusStr,
		Tags:        req.GetTags(),
		SearchQuery: req.GetSearchQuery(),
		SortField:   sortField,
		SortOrder:   sortOrder,
	}

	posts, total, err := s.postRepository.List(ctx, params)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list posts: %v", err)
	}

	// Готовим список ID для агрегатов рейтинга.
	postIDs := make([]string, 0, len(posts))
	for i := range posts {
		postIDs = append(postIDs, posts[i].ID)
	}

	ratingMap, err := s.ratingRepository.GetAggregatedRatingsForPosts(ctx, postIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get ratings: %v", err)
	}

	resp := &postsv1.ListPostsResponse{
		Posts:         make([]*postsv1.Post, 0, len(posts)),
		NextPageToken: "",
		TotalCount:    total,
	}

	for i := range posts {
		p := postToProto(&posts[i])
		if agg, ok := ratingMap[posts[i].ID]; ok {
			p.AverageRating = agg.AverageRating
			p.RatingsCount = agg.RatingsCount
		}
		resp.Posts = append(resp.Posts, p)
	}

	if len(posts) == int(pageSize) {
		resp.NextPageToken = strconv.Itoa(offset + int(pageSize))
	}

	return resp, nil
}

// UpdatePost - частичное обновление поста через FieldMask.
func (s *PostService) UpdatePost(ctx context.Context, req *postsv1.UpdatePostRequest) (*postsv1.UpdatePostResponse, error) {
	if req.GetPost() == nil {
		return nil, status.Error(codes.InvalidArgument, "post is required")
	}
	id := req.GetPost().GetId()
	if id == "" {
		return nil, status.Error(codes.InvalidArgument, "post.id is required")
	}

	// Получаем текущую версию поста.
	current, err := s.postRepository.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

	// Определяем, какие поля обновлять.
	mask := req.GetUpdateMask()
	fieldsToUpdate := make([]string, 0)

	if mask == nil || len(mask.Paths) == 0 {
		fieldsToUpdate = []string{"title", "content", "tags", "status"}
	} else {
		for _, p := range mask.Paths {
			switch p {
			case "title", "content", "tags", "status":
				fieldsToUpdate = append(fieldsToUpdate, p)
			default:
				// неизвестные поля игнорируем
			}
		}
	}

	reqPost := req.GetPost()
	for _, f := range fieldsToUpdate {
		switch f {
		case "title":
			current.Title = reqPost.GetTitle()
		case "content":
			current.Content = reqPost.GetContent()
		case "tags":
			current.Tags = reqPost.GetTags()
		case "status":
			current.Status = reqPost.GetStatus().String()
		}
	}

	updated, err := s.postRepository.Update(ctx, current, fieldsToUpdate)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to update post: %v", err)
	}

	avg, count, err := s.ratingRepository.GetAggregatedRating(ctx, updated.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get rating: %v", err)
	}

	respPost := postToProto(updated)
	respPost.AverageRating = avg
	respPost.RatingsCount = count

	return &postsv1.UpdatePostResponse{
		Post: respPost,
	}, nil
}

// DeletePost - метод для удаления поста по ID (пустой успешный ответ).
func (s *PostService) DeletePost(ctx context.Context, req *postsv1.DeletePostRequest) (*postsv1.DeletePostResponse, error) {
	id := req.GetId()
	if id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	err := s.postRepository.DeleteByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to delete post: %v", err)
	}

	return &postsv1.DeletePostResponse{}, nil
}

// RatePost - сохранение/обновление рейтинга и возврат поста с обновлёнными полями average_rating/ratings_count.
func (s *PostService) RatePost(ctx context.Context, req *postsv1.RatePostRequest) (*postsv1.RatePostResponse, error) {
	postID := req.GetPostId()
	if postID == "" {
		return nil, status.Error(codes.InvalidArgument, "post_id is required")
	}

	userID := req.GetUserId()
	if userID == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	rate := req.GetRate()
	if rate < 1 || rate > 5 {
		return nil, status.Error(codes.InvalidArgument, "rate must be between 1 and 5")
	}

	// Проверяем, что пост существует.
	post, err := s.postRepository.GetByID(ctx, postID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

	// Сохраняем/обновляем рейтинг.
	if err := s.ratingRepository.UpsertRating(ctx, postID, userID, rate, req.GetComment()); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save rating: %v", err)
	}

	avg, count, err := s.ratingRepository.GetAggregatedRating(ctx, postID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get rating: %v", err)
	}

	respPost := postToProto(post)
	respPost.AverageRating = avg
	respPost.RatingsCount = count

	return &postsv1.RatePostResponse{
		Post: respPost,
	}, nil
}

// postToProto - базовое преобразование доменной модели Post в gRPC-модель posts.v1.Post
// (без рейтингов — они добавляются в вызывающем коде).
func postToProto(post *repository.Post) *postsv1.Post {
	var statusEnum postsv1.PostStatus
	if post.Status != "" {
		if val, ok := postsv1.PostStatus_value[post.Status]; ok {
			statusEnum = postsv1.PostStatus(val)
		} else {
			statusEnum = postsv1.PostStatus_DRAFT
		}
	}

	return &postsv1.Post{
		Id:       post.ID,
		AuthorId: post.AuthorId,
		Title:    post.Title,
		Content:  post.Content,
		Tags:     post.Tags,
		Status:   statusEnum,
		CreatedAt: timestamppb.New(post.CreatedAt),
		UpdatedAt: timestamppb.New(post.UpdatedAt),
		// average_rating и ratings_count заполняются отдельно
	}
}
