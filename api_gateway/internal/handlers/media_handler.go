package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type UserClient interface {
    GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error)
    UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error)
}

type FileHandler struct {
    uploadDir string
	client UserClient
}

func NewFileHandler(client UserClient) *FileHandler {

    uploadDir := "/home/appuser/uploads/avatars"
    os.MkdirAll(uploadDir, 0755)
    
    return &FileHandler{
        uploadDir: uploadDir,
        client: client,
    }
}

func (h *FileHandler) UploadAvatar(c *gin.Context) {
    userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

    file, header, err := c.Request.FormFile("avatar")
    if err != nil {
        c.JSON(400, gin.H{"error": "No file uploaded"})
        return
    }
    defer file.Close()
    
    ext := filepath.Ext(header.Filename)
    filename := fmt.Sprintf("%s_%s%s", userId, uuid.New().String()[:8], ext)
    filepath := filepath.Join(h.uploadDir, filename)

    out, err := os.Create(filepath)
    if err != nil {
        c.JSON(500, gin.H{"error": "Failed to save file"})
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
    
    c.JSON(200, gin.H{
        "url": fileURL,
        "filename": filename,
    })
}

func (h *FileHandler) GetAvatar(c *gin.Context) {
    filename := c.Param("filename")
    if strings.Contains(filename, "..") {
        c.JSON(400, gin.H{"error": "Invalid filename"})
        return
    }
    
    filepath := filepath.Join(h.uploadDir, filename)
    
    // Проверяем существование файла
    if _, err := os.Stat(filepath); os.IsNotExist(err) {
        // Возвращаем дефолтную аватарку
        defaultPath := "./uploads/avatars/default.png"
        if _, err := os.Stat(defaultPath); os.IsNotExist(err) {
            // Создаем простую дефолтную аватарку
            if err := h.createDefaultAvatar(defaultPath); err != nil {
                c.JSON(500, gin.H{"error": "Failed to create default avatar"})
                return
            }
        }
        c.File(defaultPath)
        return
    }
    
    c.File(filepath)
}

func (h *FileHandler) DeleteAvatar(c *gin.Context) {
    userId, ok := utils.GetUserIdFromContext(c)
    if !ok {
        return 
    }
    
    filename := c.Query("filename")
    if filename == "" {
        c.JSON(400, gin.H{"error": "filename is required"})
        return
    }
    
    // Очищаем имя файла от потенциальных путей
    filename = filepath.Base(filename)

    filepath := filepath.Join(h.uploadDir, filename)

    if _, err := os.Stat(filepath); os.IsNotExist(err) {
        // Файла нет, но все равно обновляем профиль
        fmt.Printf("File %s not found, updating profile anyway\n", filename)
    } else {
        // Файл существует - удаляем его
        if err := os.Remove(filepath); err != nil {
            c.JSON(500, gin.H{"error": "Failed to delete file: " + err.Error()})
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


    c.JSON(200, gin.H{"message": "Avatar deleted"})
}

func (h *FileHandler) createDefaultAvatar(path string) error {
    // Создаем директорию, если не существует
    if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
        return fmt.Errorf("failed to create directory: %v", err)
    }
    
    svg := `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#4f46e5"/>
        <text x="100" y="100" font-family="Arial" font-size="60" fill="white" 
            text-anchor="middle" dominant-baseline="middle">?</text>
    </svg>`
    
    if err := os.WriteFile(path, []byte(svg), 0644); err != nil {
        return fmt.Errorf("failed to write default avatar: %v", err)
    }
    
    return nil
}

func extractFilenameFromURL(url string) string {
    // Удаляем префикс пути
    prefix := "/api/v1/files/avatar/"
    if !strings.HasPrefix(url, prefix) {
        // Если URL не содержит префикс, пробуем извлечь последнюю часть
        return filepath.Base(url)
    }
    
    // Извлекаем часть после префикса
    filename := strings.TrimPrefix(url, prefix)
    
    // Берем только имя файла (на случай, если там что-то лишнее)
    return filepath.Base(filename)
}