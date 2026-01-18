package handlers

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
    postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type UserClient interface {
    GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error)
    UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error)
}

type PostClient interface {
    GetPost(ctx context.Context, in *postsv1.GetPostRequest) (*postsv1.GetPostResponse, error)
    UploadPostImage(ctx context.Context, req *postsv1.UploadPostImageRequest) (*postsv1.UploadPostImageResponse, error)
    DeletePostImage(ctx context.Context, req *postsv1.DeletePostImageRequest) (*postsv1.DeletePostImageResponse, error)
}

type FileHandler struct {
    uploadDirAvatar string
    uploadDirPostImage string
	client UserClient
    postClient PostClient
}

func NewFileHandler(client UserClient, postClient PostClient) *FileHandler {

    uploadDirAvatar := "/home/appuser/uploads/avatars"
    uploadDirPostImage := "/home/appuser/uploads/posts"
    os.MkdirAll(uploadDirAvatar, 0755)
    os.MkdirAll(uploadDirPostImage, 0755)
    return &FileHandler{
        uploadDirAvatar: uploadDirAvatar,
        uploadDirPostImage: uploadDirPostImage,
        client: client,
        postClient: postClient,
    }
}

// UploadAvatar godoc
// @Summary Загрузить аватар
// @Description Загружает аватар пользователя и обновляет ссылку в профиле. Максимальный размер файла: 5MB. Разрешенные форматы: jpg, jpeg, png, gif, svg.
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param avatar formData file true "Файл аватара" swaggertype:"string" format:"binary"
// @Success 200 {object} domain.UploadAvatarResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 413 {object} utils.ErrorResponse "Файл слишком большой"
// @Failure 415 {object} utils.ErrorResponse "Неподдерживаемый формат файла"
// @Failure 500 {object} utils.ErrorResponse
// @Router /files/avatar [post]
func (h *FileHandler) UploadAvatar(c *gin.Context) {
    userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

    file, header, err := c.Request.FormFile("avatar")
    if err != nil {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error: "BAD_REQUEST",
            Message: "No file uploaded",
        })
        return
    }
    defer file.Close()
    
    ext := filepath.Ext(header.Filename)
    filename := fmt.Sprintf("%s_%s%s", userId, uuid.New().String()[:8], ext)
    filepath := filepath.Join(h.uploadDirAvatar, filename)

    out, err := os.Create(filepath)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error: "INTERNAL_ERROR",
            Message: "failed to save file",
        })
        return
    }
    defer out.Close()
    
    io.Copy(out, file)

    fileURL := fmt.Sprintf("/api/v1/files/avatar/%s", filename)
    grpcReq := userv1.UpdateProfileRequest{
        UserId: userId,
        AvatarUrl: &fileURL,
    }
    _, err = h.client.UpdateProfile(c.Request.Context(), &grpcReq)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error: "INTERNAL_ERROR",
            Message: "failed to upload avatar",
        })
        return
    }
    
    c.JSON(200, domain.UploadAvatarResponse{
		URL:      fileURL,
		Filename: filename,
	})
}

// GetAvatar godoc
// @Summary Получить аватар
// @Description Возвращает файл аватара по имени файла или дефолтный аватар
// @Tags files
// @Security BearerAuth
// @Produce image/png,image/jpeg,image/gif,image/svg+xml
// @Param filename path string true "Имя файла аватара"
// @Success 200 {file} file "Файл аватара"
// @Failure 400 {object} utils.ErrorResponse "Неверное имя файла"
// @Failure 500 {object} utils.ErrorResponse "Ошибка сервера"
// @Router /files/avatar/{filename} [get]
func (h *FileHandler) GetAvatar(c *gin.Context) {
    filename := c.Param("filename")
    if strings.Contains(filename, "..") {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{Error: "BAD_REQUEST", Message: "Invalid filename"})
        return
    }
    
    filename = filepath.Base(filename)
    filepathStr := filepath.Join(h.uploadDirAvatar, filename)
 
    c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
    c.Header("Pragma", "no-cache")
    
    if _, err := os.Stat(filepathStr); os.IsNotExist(err) {
        h.serveDefaultAvatar(c)
        return
    }

    data, err := os.ReadFile(filepathStr)
    if err != nil {
        h.serveDefaultAvatar(c)
        return
    }

    contentType := http.DetectContentType(data)
    
    if contentType == "application/octet-stream" || contentType == "text/plain" {
        ext := strings.ToLower(filepath.Ext(filename))
        switch ext {
        case ".jpg", ".jpeg":
            contentType = "image/jpeg"
        case ".png":
            contentType = "image/png"
        case ".gif":
            contentType = "image/gif"
        case ".svg":
            contentType = "image/svg+xml"
        default:
            contentType = "image/png"
        }
    }
    
    c.Data(http.StatusOK, contentType, data)
}

// DeleteAvatar godoc
// @Summary Удалить аватар
// @Description Удаляет аватар пользователя и очищает ссылку в профиле
// @Tags files
// @Produce json
// @Security BearerAuth
// @Param filename query string true "Имя файла аватара"
// @Success 200 {object} domain.DeleteAvatarResponse
// @Failure 400 {object} utils.ErrorResponse "Не указано имя файла"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 500 {object} utils.ErrorResponse "Ошибка сервера"
// @Router /files/avatar [delete]
func (h *FileHandler) DeleteAvatar(c *gin.Context) {
    userId, ok := utils.GetUserIdFromContext(c)
    if !ok {
        return 
    }
    
    filename := c.Query("filename")
    if filename == "" {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error: "BAD_REQUEST",
            Message: "filename is empty",
        })
        return
    }

    filename = filepath.Base(filename)

    filepath := filepath.Join(h.uploadDirAvatar, filename)

    if _, err := os.Stat(filepath); os.IsNotExist(err) {
        slog.Error("File not found, updating profile anyway\n", "filename", filename)
    } else {
        if err := os.Remove(filepath); err != nil {
            c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
                Error: "INTERNAL_ERROR",
                Message: "failed to upload avatar",
            })
            return
        }
    }
    
    emptyUrl := ""
    grpcReq := userv1.UpdateProfileRequest{
        UserId: userId,
        AvatarUrl: &emptyUrl,
    }

    _, err := h.client.UpdateProfile(c.Request.Context(), &grpcReq)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error: "INTERNAL_ERROR",
            Message: "failed to upload avatar",
        })
    }


    c.JSON(http.StatusOK, domain.DeleteAvatarResponse{Message: "Avatar deleted"})
}


func (h *FileHandler) serveDefaultAvatar(c *gin.Context) {
    slog.Info("Serving default SVG avatar")

    svg := `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#4f46e5"/>
                <stop offset="100%" stop-color="#7c3aed"/>
            </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#grad)" rx="20"/>
        <circle cx="100" cy="80" r="40" fill="white" opacity="0.8"/>
        <circle cx="100" cy="140" r="60" fill="white" opacity="0.8"/>
        <text x="100" y="110" font-family="Arial, sans-serif" font-size="50" 
              fill="#4f46e5" text-anchor="middle" font-weight="bold">U</text>
    </svg>`
    
    c.Header("Content-Type", "image/svg+xml")
    c.String(http.StatusOK, svg)
}

// UploadAvatar godoc
// @Summary Загрузить аватар поста
// @Description Загружает аватар поста и обновляет ссылку в профиле. Максимальный размер файла: 5MB. Разрешенные форматы: jpg, jpeg, png, gif, svg.
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Param post_id path string true "Post ID" example("12345")
// @Security BearerAuth
// @Param avatar formData file true "Файл аватара поста"
// @Success 200 {object} domain.UploadAvatarResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 413 {object} utils.ErrorResponse "Файл слишком большой"
// @Failure 415 {object} utils.ErrorResponse "Неподдерживаемый формат файла"
// @Failure 500 {object} utils.ErrorResponse
// @Router /files/posts/avatar/{post_id} [post]
func (h *FileHandler) UploadPostAvatar(c *gin.Context) {
    postId := c.Param("post_id")

    if postId == "" {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error:   "BAD_REQUEST",
            Message: "Post ID is required",
        })
        return
    }

    file, header, err := c.Request.FormFile("avatar")
    if err != nil {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error:   "BAD_REQUEST",
            Message: "No file to upload or incorrect field name. Use 'avatar' field",
        })
        return
    }
    defer file.Close()
    
    ext := filepath.Ext(header.Filename)
    filename := fmt.Sprintf("%s_%s%s", postId, uuid.New().String()[:8], ext)
    filepath := filepath.Join(h.uploadDirPostImage, filename)

    out, err := os.Create(filepath)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error: "INTERNAL_ERROR",
            Message: "failed to save file",
        })
        return
    }
    defer out.Close()
    
    io.Copy(out, file)

    fileURL := fmt.Sprintf("/api/v1/files/posts/avatar/%s", filename)
    
    grpcReq := postsv1.UploadPostImageRequest{
        PostId: postId,
        ImageUrl: fileURL,
    }
    _, err = h.postClient.UploadPostImage(c.Request.Context(), &grpcReq)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error: "INTERNAL_ERROR",
            Message: "Failed to upload post avatar",
        })
    }
    
    c.JSON(http.StatusOK, domain.UploadAvatarResponse{
		URL:      fileURL,
		Filename: filename,
	})
}

// GetAvatar godoc
// @Summary Получить аватар
// @Description Возвращает файл аватара по имени файла или дефолтный аватар
// @Tags files
// @Security BearerAuth
// @Produce image/png,image/jpeg,image/gif,image/svg+xml
// @Param filename path string true "Имя файла аватара"
// @Success 200 {file} file "Файл аватара"
// @Failure 400 {object} utils.ErrorResponse "Неверное имя файла"
// @Failure 500 {object} utils.ErrorResponse "Ошибка сервера"
// @Router /files/posts/avatar/{filename} [get]
func (h *FileHandler) GetPostAvatar(c *gin.Context) {
    filename := c.Param("filename")
    if strings.Contains(filename, "..") {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{Error: "BAD_REQUEST", Message: "Invalid filename"})
        return
    }
    
    filename = filepath.Base(filename)
    filepathStr := filepath.Join(h.uploadDirPostImage, filename)

    c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
    c.Header("Pragma", "no-cache")
    
    if _, err := os.Stat(filepathStr); os.IsNotExist(err) {
        h.serveDefaultAvatar(c)
        return
    }

    data, err := os.ReadFile(filepathStr)
    if err != nil {
        h.serveDefaultAvatar(c)
        return
    }

    contentType := http.DetectContentType(data)

    if contentType == "application/octet-stream" || contentType == "text/plain" {
        ext := strings.ToLower(filepath.Ext(filename))
        switch ext {
        case ".jpg", ".jpeg":
            contentType = "image/jpeg"
        case ".png":
            contentType = "image/png"
        case ".gif":
            contentType = "image/gif"
        case ".svg":
            contentType = "image/svg+xml"
        default:
            contentType = "image/png"
        }
    }
    
    c.Data(http.StatusOK, contentType, data)
}

// DeletePostAvatar godoc
// @Summary Удалить аватар поста
// @Description Удаляет аватар поста и очищает ссылку в профиле
// @Tags files
// @Produce json
// @Security BearerAuth
// @Param post_id path string true "Post ID"
// @Success 200 {object} domain.DeleteAvatarResponse
// @Failure 400 {object} utils.ErrorResponse "Не указан post_id"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 500 {object} utils.ErrorResponse "Ошибка сервера"
// @Router /files/posts/avatar/{post_id} [delete]
func (h *FileHandler) DeletePostAvatar(c *gin.Context) {
    postId := c.Param("post_id")
    
    if postId == "" {
        c.JSON(http.StatusBadRequest, utils.ErrorResponse{
            Error:   "BAD_REQUEST",
            Message: "Post ID is required",
        })
        return
    }

    grpcReq := postsv1.GetPostRequest{
        Id: postId,
    }
    
    postResp, err := h.postClient.GetPost(c.Request.Context(), &grpcReq)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error:   "INTERNAL_ERROR",
            Message: "Failed to get post info",
        })
        return
    }

    if postResp.Post.AvatarUrl == "" {
        c.JSON(http.StatusOK, domain.DeleteAvatarResponse{
            Message: "Post has no avatar",
        })
        return
    }
    
    avatarURL := postResp.Post.AvatarUrl
    filename := filepath.Base(avatarURL)
    
    filePath := filepath.Join(h.uploadDirPostImage, filename)
    if _, err := os.Stat(filePath); err == nil {
        if err := os.Remove(filePath); err != nil {
            slog.Error("Failed to delete file", "error", err)
        }
    } else {
        slog.Warn("File not found, may have been deleted already", "filename", filename)
    }

    deleteReq := postsv1.DeletePostImageRequest{
        PostId: postId,
    }
    
    _, err = h.postClient.DeletePostImage(c.Request.Context(), &deleteReq)
    if err != nil {
        c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
            Error:   "INTERNAL_ERROR",
            Message: "Failed to update post profile",
        })
        return
    }
    
    c.JSON(http.StatusOK, domain.DeleteAvatarResponse{
        Message: "Post avatar deleted successfully",
    })
}