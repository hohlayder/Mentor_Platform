package handlers

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	
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

    uploadDir := "./uploads/avatars"
    os.MkdirAll(uploadDir, 0755)
    
    return &FileHandler{
        uploadDir: uploadDir,
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
    
    // TODO: Отправляем в микросервис пользователей через gRPC
    // обновить avatar_url для userID
    
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
            h.createDefaultAvatar(defaultPath)
        }
        c.File(defaultPath)
        return
    }
    
    c.File(filepath)
}

func (h *FileHandler) DeleteAvatar(c *gin.Context) {
    userID, _ := c.Get("user_id")
    
    // TODO: Получить имя файла из БД через микросервис
    
    // Удаляем файл
    filename := c.Query("filename")
    if filename != "" {
        filepath := filepath.Join(h.uploadDir, filename)
        os.Remove(filepath)
    }
    
    c.JSON(200, gin.H{"message": "Avatar deleted"})
}

func (h *FileHandler) createDefaultAvatar(path string) {
    // Создаем простую синюю аватарку
    // Можно просто скопировать готовую или сгенерировать
    // Для простоты - копируем из ресурсов или создаем
    os.WriteFile(path, []byte(""), 0644)
    // В реальности здесь была бы генерация/копирование PNG
}