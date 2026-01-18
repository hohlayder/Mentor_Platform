package service

import (
	"context"
	"errors"
	"strconv"

	postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"github.com/hohlayder/Mentor_Platform/post_service/internal/repository"
	"github.com/lib/pq"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// PostService - реализация gRPC-сервиса PostService.
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

// -----------------------------------------------------------------------------
// CreatePost
// -----------------------------------------------------------------------------

func (s *PostService) CreatePost(ctx context.Context, req *postsv1.CreatePostRequest) (*postsv1.CreatePostResponse, error) {
	post := &repository.Post{
		AuthorId: req.GetAuthorId(),
		Title:    req.GetTitle(),
		Content:  req.GetContent(),
		Tags:     pq.StringArray(req.GetTags()), // []string -> pq.StringArray
		Status:   req.GetStatus().String(),
	}

	if err := s.postRepository.Save(ctx, post); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create post: %v", err)
	}

	respPost := postToProto(post)
	respPost.AverageRating = 0
	respPost.RatingsCount = 0

	return &postsv1.CreatePostResponse{
		Post: respPost,
	}, nil
}

// -----------------------------------------------------------------------------
// GetPost
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// ListPosts
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// UpdatePost
// -----------------------------------------------------------------------------

func (s *PostService) UpdatePost(ctx context.Context, req *postsv1.UpdatePostRequest) (*postsv1.UpdatePostResponse, error) {
	if req.GetPost() == nil {
		return nil, status.Error(codes.InvalidArgument, "post is required")
	}
	id := req.GetPost().GetId()
	if id == "" {
		return nil, status.Error(codes.InvalidArgument, "post.id is required")
	}

	current, err := s.postRepository.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

	mask := req.GetUpdateMask()
	fieldsToUpdate := make([]string, 0)

	if mask == nil || len(mask.Paths) == 0 {
		fieldsToUpdate = []string{"avatar_url", "title", "content", "tags", "status"}
	} else {
		for _, p := range mask.Paths {
			switch p {
			case "avatar_url", "title", "content", "tags", "status":
				fieldsToUpdate = append(fieldsToUpdate, p)
			}
		}
	}

	reqPost := req.GetPost()
	for _, f := range fieldsToUpdate {
		switch f {
		case "avatar_url": 
            if reqPost.GetAvatarUrl() == "" {
                current.AvatarURL = nil
            } else {
                avatarURL := reqPost.GetAvatarUrl()
                current.AvatarURL = &avatarURL
            }
		case "title":
			current.Title = reqPost.GetTitle()
		case "content":
			current.Content = reqPost.GetContent()
		case "tags":
			current.Tags = pq.StringArray(reqPost.GetTags())
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

// -----------------------------------------------------------------------------
// DeletePost
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// RatePost
// -----------------------------------------------------------------------------

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

	post, err := s.postRepository.GetByID(ctx, postID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

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

func (s *PostService) UploadPostImage(ctx context.Context, req *postsv1.UploadPostImageRequest) (*postsv1.UploadPostImageResponse, error) {
    postID := req.GetPostId()
    if postID == "" {
        return nil, status.Error(codes.InvalidArgument, "post_id is required")
    }

    imageURL := req.GetImageUrl()
    if imageURL == "" {
        return nil, status.Error(codes.InvalidArgument, "image_url is required")
    }

    // Проверяем существование поста
    post, err := s.postRepository.GetByID(ctx, postID)
    if err != nil {
        if errors.Is(err, repository.ErrNotFound) {
            return nil, status.Error(codes.NotFound, "post not found")
        }
        return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
    }

    // Обновляем изображение
    avatarURL := imageURL
    post.AvatarURL = &avatarURL
    
    updated, err := s.postRepository.Update(ctx, post, []string{"avatar_url"})
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to update post image: %v", err)
    }

    avg, count, err := s.ratingRepository.GetAggregatedRating(ctx, postID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get rating: %v", err)
    }

    respPost := postToProto(updated)
    respPost.AverageRating = avg
    respPost.RatingsCount = count

    return &postsv1.UploadPostImageResponse{
        Post: respPost,
    }, nil
}

// DeletePostImage - удаление изображения поста
func (s *PostService) DeletePostImage(ctx context.Context, req *postsv1.DeletePostImageRequest) (*postsv1.DeletePostImageResponse, error) {
    postID := req.GetPostId()
    if postID == "" {
        return nil, status.Error(codes.InvalidArgument, "post_id is required")
    }

    // Проверяем существование поста
    post, err := s.postRepository.GetByID(ctx, postID)
    if err != nil {
        if errors.Is(err, repository.ErrNotFound) {
            return nil, status.Error(codes.NotFound, "post not found")
        }
        return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
    }

    // Очищаем изображение
    post.AvatarURL = nil
    
    updated, err := s.postRepository.Update(ctx, post, []string{"avatar_url"})
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to delete post image: %v", err)
    }

    avg, count, err := s.ratingRepository.GetAggregatedRating(ctx, postID)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to get rating: %v", err)
    }

    respPost := postToProto(updated)
    respPost.AverageRating = avg
    respPost.RatingsCount = count

    return &postsv1.DeletePostImageResponse{
        Post: respPost,
    }, nil
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

func postToProto(post *repository.Post) *postsv1.Post {
	var statusEnum postsv1.PostStatus
	if post.Status != "" {
		if val, ok := postsv1.PostStatus_value[post.Status]; ok {
			statusEnum = postsv1.PostStatus(val)
		} else {
			statusEnum = postsv1.PostStatus_DRAFT
		}
	}

	postResp := &postsv1.Post{
		Id:        post.ID,
		AuthorId:  post.AuthorId,
		Title:     post.Title,
		Content:   post.Content,
		Tags:      []string(post.Tags), // pq.StringArray -> []string
		Status:    statusEnum,
		CreatedAt: timestamppb.New(post.CreatedAt),
		UpdatedAt: timestamppb.New(post.UpdatedAt),
	}

	if post.AvatarURL != nil {
		postResp.AvatarUrl = *post.AvatarURL
	}
	return postResp
}



func (s *PostService) GetPostRatings(ctx context.Context, req *postsv1.GetPostRatingsRequest) (*postsv1.GetPostRatingsResponse, error) {
	postID := req.GetPostId()
	if postID == "" {
		return nil, status.Error(codes.InvalidArgument, "post_id is required")
	}

	// Проверяем, существует ли пост
	_, err := s.postRepository.GetByID(ctx, postID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "post not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get post: %v", err)
	}

	// Настраиваем пагинацию
	pageSize := req.GetPageSize()
	if pageSize <= 0 {
		pageSize = 20
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

	// Получаем отзывы
	ratings, total, err := s.ratingRepository.GetRatingsByPostID(ctx, postID, int(pageSize), offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get ratings: %v", err)
	}

	// Получаем агрегированные данные (средний рейтинг и количество)
	avgRating, ratingsCount, err := s.ratingRepository.GetAggregatedRating(ctx, postID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get aggregated rating: %v", err)
	}

	// Конвертируем в protobuf
	protoRatings := make([]*postsv1.Rating, 0, len(ratings))
	for _, r := range ratings {
		protoRatings = append(protoRatings, &postsv1.Rating{
			Id:        r.ID,
			PostId:    r.PostID,
			UserId:    r.UserID,
			Rate:      r.Rate,
			Comment:   r.Comment,
			CreatedAt: timestamppb.New(r.CreatedAt),
		})
	}

	resp := &postsv1.GetPostRatingsResponse{
		Ratings:       protoRatings,
		TotalCount:    total,
		AverageRating: float32(avgRating),
		RatingsCount:  ratingsCount,
	}

	// Устанавливаем next_page_token если есть еще данные
	if len(ratings) == int(pageSize) {
		resp.NextPageToken = strconv.Itoa(offset + int(pageSize))
	}

	return resp, nil
}

func stringPtr(s string) *string {
    if s == "" {
        return nil
    }
    return &s
}