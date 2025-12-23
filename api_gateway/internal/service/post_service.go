package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
)

type PostClient interface {
	CreatePost(ctx context.Context, in *postsv1.CreatePostRequest) (*postsv1.CreatePostResponse, error)
	GetPost(ctx context.Context, in *postsv1.GetPostRequest) (*postsv1.GetPostResponse, error)
	ListPosts(ctx context.Context, in *postsv1.ListPostsRequest) (*postsv1.ListPostsResponse, error)
	UpdatePost(ctx context.Context, in *postsv1.UpdatePostRequest) (*postsv1.UpdatePostResponse, error)
	DeletePost(ctx context.Context, in *postsv1.DeletePostRequest) (*postsv1.DeletePostResponse, error)
	RatePost(ctx context.Context, in *postsv1.RatePostRequest) (*postsv1.RatePostResponse, error)
}

type PostService struct {
	postClient PostClient
}

func NewPostService(postClient PostClient) *PostService {
	return &PostService{postClient: postClient}
}

func (s *PostService) CreatePost(ctx context.Context, authorID string, req domain.CreatePostRequest) (*domain.Post, error) {
	status, ok := postsv1.PostStatus_value[req.Status]
	if !ok {
		status = int32(postsv1.PostStatus_DRAFT)
	}

	grpcReq := &postsv1.CreatePostRequest{
		AuthorId: authorID,
		Title:    req.Title,
		Content:  req.Content,
		Tags:     req.Tags,
		Status:   postsv1.PostStatus(status),
	}

	resp, err := s.postClient.CreatePost(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to create post via gRPC", "error", err)
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	return convertPostFromProto(resp.Post), nil
}

func (s *PostService) GetPost(ctx context.Context, postID string) (*domain.Post, error) {
	if postID == "" {
		return nil, errors.New("post ID is required")
	}

	grpcReq := &postsv1.GetPostRequest{
		Id: postID,
	}

	resp, err := s.postClient.GetPost(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to get post via gRPC", "error", err, "post_id", postID)
		return nil, fmt.Errorf("failed to get post: %w", err)
	}

	return convertPostFromProto(resp.Post), nil
}

func (s *PostService) ListPosts(ctx context.Context, req domain.ListPostsRequest) (*domain.ListPostsResponse, error) {
	var statusEnum postsv1.PostStatus
	if req.Status != "" {
		if val, ok := postsv1.PostStatus_value[req.Status]; ok {
			statusEnum = postsv1.PostStatus(val)
		}
	}

	sortField := postsv1.SortField_CREATED_AT
	switch req.SortField {
	case "updated_at":
		sortField = postsv1.SortField_UPDATED_AT
	case "title":
		sortField = postsv1.SortField_TITLE
	}

	sortOrder := postsv1.SortOrder_DESC
	if req.SortOrder == "asc" {
		sortOrder = postsv1.SortOrder_ASC
	}

	grpcReq := &postsv1.ListPostsRequest{
		PageToken:   req.PageToken,
		PageSize:    req.PageSize,
		AuthorId:    req.AuthorID,
		Status:      statusEnum,
		Tags:        req.Tags,
		SearchQuery: req.SearchQuery,
		SortField:   sortField,
		SortOrder:   sortOrder,
	}

	resp, err := s.postClient.ListPosts(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to list posts via gRPC", "error", err)
		return nil, fmt.Errorf("failed to list posts: %w", err)
	}

	return convertListResponseFromProto(resp), nil
}

func (s *PostService) UpdatePost(ctx context.Context, postID string, req domain.UpdatePostRequest) (*domain.Post, error) {
	if req.Post.ID != postID {
		return nil, errors.New("post ID in path does not match ID in body")
	}

	protoPost := &postsv1.Post{
		Id: postID,
	}

	var fieldMaskPaths []string

	if req.Post.Title != nil {
		protoPost.Title = *req.Post.Title
		fieldMaskPaths = append(fieldMaskPaths, "title")
	}
	
	if req.Post.Content != nil {
		protoPost.Content = *req.Post.Content
		fieldMaskPaths = append(fieldMaskPaths, "content")
	}
	
	if req.Post.Tags != nil {
		protoPost.Tags = *req.Post.Tags
		fieldMaskPaths = append(fieldMaskPaths, "tags")
	}
	
	if req.Post.Status != nil {
		upperStatus := strings.ToUpper(*req.Post.Status)
		status, ok := postsv1.PostStatus_value[upperStatus]
		if !ok {
			return nil, errors.New("invalid post status")
		}
		protoPost.Status = postsv1.PostStatus(status)
		fieldMaskPaths = append(fieldMaskPaths, "status")
	}

	if len(fieldMaskPaths) == 0 {
		return nil, errors.New("no fields to update")
	}

	fieldMask, err := fieldmaskpb.New(protoPost, fieldMaskPaths...)
	if err != nil {
		return nil, fmt.Errorf("invalid field mask: %w", err)
	}

	grpcReq := &postsv1.UpdatePostRequest{
		Post:       protoPost,
		UpdateMask: fieldMask,
	}

	resp, err := s.postClient.UpdatePost(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to update post via gRPC", "error", err, "post_id", postID)
		return nil, fmt.Errorf("failed to update post: %w", err)
	}

	return convertPostFromProto(resp.Post), nil
}

func (s *PostService) DeletePost(ctx context.Context, postID string) error {
	if postID == "" {
		return errors.New("post ID is required")
	}

	grpcReq := &postsv1.DeletePostRequest{
		Id: postID,
	}

	_, err := s.postClient.DeletePost(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to delete post via gRPC", "error", err, "post_id", postID)
		return fmt.Errorf("failed to delete post: %w", err)
	}

	return nil
}

func (s *PostService) RatePost(ctx context.Context, postID, userID string, req domain.RatePostRequest) (*domain.Post, error) {
	if postID == "" {
		return nil, errors.New("post ID is required")
	}
	if userID == "" {
		return nil, errors.New("user ID is required")
	}
	if req.Rate < 1 || req.Rate > 5 {
		return nil, errors.New("rate must be between 1 and 5")
	}

	grpcReq := &postsv1.RatePostRequest{
		PostId:  postID,
		UserId:  userID,
		Rate:    req.Rate,
	}

	if req.Comment != nil {
		grpcReq.Comment = *req.Comment
	}

	resp, err := s.postClient.RatePost(ctx, grpcReq)
	if err != nil {
		slog.Error("Failed to rate post via gRPC", "error", err, "post_id", postID)
		return nil, fmt.Errorf("failed to rate post: %w", err)
	}

	return convertPostFromProto(resp.Post), nil
}

func convertPostFromProto(protoPost *postsv1.Post) *domain.Post {
	if protoPost == nil {
		return nil
	}

	return &domain.Post{
		ID:            protoPost.Id,
		AuthorID:      protoPost.AuthorId,
		Title:         protoPost.Title,
		Content:       protoPost.Content,
		Tags:          protoPost.Tags,
		Status:        protoPost.Status.String(),
		AverageRating: protoPost.AverageRating,
		RatingsCount:  protoPost.RatingsCount,
		CreatedAt:     protoPost.CreatedAt.AsTime(),
		UpdatedAt:     protoPost.UpdatedAt.AsTime(),
	}
}

func convertListResponseFromProto(protoResp *postsv1.ListPostsResponse) *domain.ListPostsResponse {
	if protoResp == nil {
		return &domain.ListPostsResponse{
			Posts:      []domain.Post{},
			TotalCount: 0,
		}
	}

	posts := make([]domain.Post, 0, len(protoResp.Posts))
	for _, protoPost := range protoResp.Posts {
		if post := convertPostFromProto(protoPost); post != nil {
			posts = append(posts, *post)
		}
	}

	return &domain.ListPostsResponse{
		Posts:         posts,
		NextPageToken: protoResp.NextPageToken,
		TotalCount:    protoResp.TotalCount,
	}
}



func (s *PostService) CheckPostOwnership(ctx context.Context, postID, authorID string) (bool, error) {
	post, err := s.GetPost(ctx, postID)
	if err != nil {
		return false, err
	}

	return post.AuthorID == authorID, nil
}

func (s *PostService) ValidatePostStatus(status string) bool {
	statusUpper := strings.ToUpper(status)
	_, ok := postsv1.PostStatus_value[statusUpper]
	return ok
}