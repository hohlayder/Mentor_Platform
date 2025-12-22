// api_gateway/internal/handlers/media_handler.go
package handlers

import (
	"bytes"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"github.com/nfnt/resize"
	"golang.org/x/image/webp"
)

// MediaHandler отвечает за загрузку и отдачу медиафайлов
type MediaHandler struct {
	userService      UserService
	uploadDir        string
	baseURL          string
	fileCache        sync.Map 
	svgCache         sync.Map 
	metadataCache    sync.Map

	maxFileSize      int64
	allowedMimeTypes map[string]bool
}

type Metadata struct {
	ETag         string
	ContentType  string
	Size         int64
	LastModified time.Time
}

// NewMediaHandler создает новый обработчик медиа
func NewMediaHandler(userService UserService) *MediaHandler {
	uploadDir := "./uploads/avatars"
	os.MkdirAll(uploadDir, 0755)
	
	handler := &MediaHandler{
		userService: userService,
		uploadDir:   uploadDir,
		baseURL:     "http://localhost:8080",
		maxFileSize: 10 * 1024 * 1024, // 10MB
		allowedMimeTypes: map[string]bool{
			"image/jpeg": true,
			"image/png":  true,
			"image/webp": true,
			"image/gif":  true,
		},
	}

	go handler.cleanupCache()
	
	return handler
}

func (h *MediaHandler) UploadAvatar(c *gin.Context) {
	start := time.Now()
	
	userIDForUpdate := c.Param("id")
	userID, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	if userID != userIDForUpdate {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "Cannot upload avatar for another user",
		})
		return
	}

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Avatar file is required",
		})
		return
	}
	defer file.Close()

	if header.Size > h.maxFileSize {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: fmt.Sprintf("File too large. Max size: %dMB", h.maxFileSize/(1024*1024)),
		})
		return
	}

	fileBytes, err := io.ReadAll(io.LimitReader(file, h.maxFileSize))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Cannot read file",
		})
		return
	}

	contentType := http.DetectContentType(fileBytes[:512])
	if !h.allowedMimeTypes[contentType] {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: fmt.Sprintf("Unsupported file type: %s", contentType),
		})
		return
	}

	fileHash := sha256.Sum256(fileBytes)
	hashStr := hex.EncodeToString(fileHash[:8]) 
	ext := h.getExtension(contentType)

	filename := fmt.Sprintf("%s_%s_%s%s", 
		userID, 
		hashStr, 
		uuid.New().String()[:8], 
		ext,
	)
	
	filePath := filepath.Join(h.uploadDir, filename)

	if err := os.WriteFile(filePath, fileBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Cannot save file",
		})
		return
	}

	go h.generateThumbnails(filename, fileBytes)

	if len(fileBytes) < 1024*1024 { 
		h.fileCache.Store(filename, fileBytes)
		h.metadataCache.Store(filename, Metadata{
			ETag:         fmt.Sprintf("\"%s\"", hashStr),
			ContentType:  contentType,
			Size:         int64(len(fileBytes)),
			LastModified: time.Now(),
		})
	}

	avatarURL := fmt.Sprintf("%s/media/avatars/%s", h.baseURL, filename)

	req := domain.UpdateProfileRequest{
		AvatarURL: &avatarURL,
	}
	if _, err := h.userService.UpdateProfile(c.Request.Context(), userID, req); err != nil {
		slog.Error("Failed to update avatar in user_service", "error", err)
	}

	slog.Info("Avatar uploaded", 
		"user_id", userID, 
		"size", header.Size,
		"duration", time.Since(start),
	)

	c.JSON(http.StatusOK, AvatarResponse{
		AvatarURL: avatarURL,
		Filename:  filename,
		Size:      header.Size,
		Duration:  time.Since(start).Milliseconds(),
	})
}

func (h *MediaHandler) GetAvatar(c *gin.Context) {
	filename := c.Param("filename")

	if !h.isValidFilename(filename) {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid filename",
		})
		return
	}

	if data, ok := h.fileCache.Load(filename); ok {
		h.serveFromMemory(c, filename, data.([]byte))
		return
	}

	width, _ := strconv.Atoi(c.DefaultQuery("w", "0"))
	height, _ := strconv.Atoi(c.DefaultQuery("h", "0"))

	if width > 0 || height > 0 {
		resizeKey := fmt.Sprintf("%s_%dx%d", filename, width, height)
		if data, ok := h.fileCache.Load(resizeKey); ok {
			h.serveFromMemory(c, filename, data.([]byte))
			return
		}
	}

	filePath := filepath.Join(h.uploadDir, filename)

	if _, err := os.Stat(filePath); err == nil {
		if width > 0 || height > 0 {
			h.serveResized(c, filePath, filename, width, height)
			return
		}

		h.serveFileDirect(c, filePath, filename)
		return
	}

	h.serveGeneratedAvatar(c, filename)
}



func (h *MediaHandler) serveFromMemory(c *gin.Context, filename string, data []byte) {
	var contentType string
	var etag string
	
	if meta, ok := h.metadataCache.Load(filename); ok {
		metadata := meta.(Metadata)
		etag = metadata.ETag
		contentType = metadata.ContentType
		
		c.Header("ETag", etag)
		c.Header("Content-Type", contentType)
		c.Header("Last-Modified", metadata.LastModified.Format(time.RFC1123))
		c.Header("Content-Length", strconv.FormatInt(metadata.Size, 10))
	} else {
		contentType = http.DetectContentType(data[:512])
		etag = fmt.Sprintf("\"%x\"", md5.Sum(data))
		
		c.Header("ETag", etag)
		c.Header("Content-Type", contentType)
		c.Header("Content-Length", strconv.FormatInt(int64(len(data)), 10))
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Expires", time.Now().Add(365*24*time.Hour).Format(time.RFC1123))

	c.Header("Vary", "Accept-Encoding")

	if match := c.GetHeader("If-None-Match"); match != "" && etag != "" {
		if match == etag || strings.TrimPrefix(match, "W/") == etag {
			c.Status(http.StatusNotModified)
			return
		}
	}

	c.Data(http.StatusOK, contentType, data)
}

func (h *MediaHandler) serveFileDirect(c *gin.Context, filePath, filename string) {
	stat, err := os.Stat(filePath)
	if err != nil {
		h.serveGeneratedAvatar(c, filename)
		return
	}

	etag := fmt.Sprintf("\"%x-%d\"", md5.Sum([]byte(filename+stat.ModTime().String())), stat.Size())

	if match := c.GetHeader("If-None-Match"); match == etag {
		c.Status(http.StatusNotModified)
		return
	}

	c.Header("ETag", etag)
	c.Header("Cache-Control", "public, max-age=3600") 
	c.Header("Last-Modified", stat.ModTime().Format(time.RFC1123))

	c.File(filePath)
}

func (h *MediaHandler) serveResized(c *gin.Context, filePath, filename string, width, height int) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		h.serveGeneratedAvatar(c, filename)
		return
	}

	var img image.Image
	switch {
	case strings.HasSuffix(filename, ".jpg"), strings.HasSuffix(filename, ".jpeg"):
		img, err = jpeg.Decode(bytes.NewReader(data))
	case strings.HasSuffix(filename, ".png"):
		img, err = png.Decode(bytes.NewReader(data))
	case strings.HasSuffix(filename, ".webp"):
		img, err = webp.Decode(bytes.NewReader(data))
	default:
		h.serveFileDirect(c, filePath, filename)
		return
	}
	
	if err != nil {
		h.serveFileDirect(c, filePath, filename)
		return
	}

	resized := resize.Resize(uint(width), uint(height), img, resize.Lanczos3)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 85}); err != nil {
		h.serveFileDirect(c, filePath, filename)
		return
	}
	
	resizedData := buf.Bytes()

	resizeKey := fmt.Sprintf("%s_%dx%d", filename, width, height)
	h.fileCache.Store(resizeKey, resizedData)
	h.metadataCache.Store(resizeKey, Metadata{
		ETag:         fmt.Sprintf("\"%x\"", md5.Sum(resizedData)),
		ContentType:  "image/jpeg",
		Size:         int64(len(resizedData)),
		LastModified: time.Now(),
	})
	
	c.Header("Content-Type", "image/jpeg")
	c.Header("Cache-Control", "public, max-age=86400") // 1 день
	c.Data(http.StatusOK, "image/jpeg", resizedData)
}

func (h *MediaHandler) serveGeneratedAvatar(c *gin.Context, filename string) {
	parts := strings.Split(filename, "_")
	if len(parts) == 0 {
		h.serveDefaultAvatar(c)
		return
	}
	
	userID := parts[0]

	if svg, ok := h.svgCache.Load(userID); ok {
		c.Header("Content-Type", "image/svg+xml")
		c.Header("Cache-Control", "public, max-age=604800")
		c.String(http.StatusOK, svg.(string))
		return
	}

	svg := h.generateSVG(userID)
	h.svgCache.Store(userID, svg)
	
	c.Header("Content-Type", "image/svg+xml")
	c.Header("Cache-Control", "public, max-age=604800")
	c.String(http.StatusOK, svg)
}

func (h *MediaHandler) generateSVG(userID string) string {
	colors := []string{
		"#FF5252", "#FF4081", "#E040FB", "#7C4DFF",
		"#536DFE", "#448AFF", "#40C4FF", "#18FFFF",
		"#64FFDA", "#69F0AE", "#B2FF59", "#EEFF41",
		"#FFFF00", "#FFD740", "#FFAB40", "#FF6E40",
	}
	
	hash := 0
	for _, r := range userID {
		hash = (hash*31 + int(r)) % len(colors)
	}
	color := colors[hash]
	
	initials := "U"
	if len(userID) > 0 {
		initials = strings.ToUpper(string(userID[0]))
	}
	
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="grad" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
			<stop offset="0%%" stop-color="%s" stop-opacity="0.9"/>
			<stop offset="100%%" stop-color="%s" stop-opacity="0.7"/>
		</linearGradient>
	</defs>
	<rect width="100" height="100" rx="15" fill="url(#grad)"/>
	<text x="50" y="60" font-family="Arial, sans-serif" font-size="40" 
	      fill="white" text-anchor="middle" font-weight="bold" 
		  dominant-baseline="central">%s</text>
</svg>`, color, color, initials)
}

func (h *MediaHandler) generateThumbnails(filename string, original []byte) {
	sizes := []struct {
		suffix string
		width  uint
		height uint
	}{
		{"_thumb", 150, 150},
		{"_small", 300, 300},
		{"_medium", 600, 600},
	}
	
	for _, size := range sizes {
		img, _, err := image.Decode(bytes.NewReader(original))
		if err != nil {
			continue
		}

		resized := resize.Resize(size.width, size.height, img, resize.Lanczos3)

		var buf bytes.Buffer
		jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 80})

		thumbName := strings.TrimSuffix(filename, filepath.Ext(filename)) + size.suffix + ".jpg"
		thumbPath := filepath.Join(h.uploadDir, thumbName)
		os.WriteFile(thumbPath, buf.Bytes(), 0644)

		thumbData := buf.Bytes()
		if len(thumbData) < 512*1024 { // < 500KB
			h.fileCache.Store(thumbName, thumbData)
		}
	}
}

func (h *MediaHandler) cleanupCache() {
	ticker := time.NewTicker(time.Hour)
	for range ticker.C {
		slog.Info("Media cache cleanup completed")
	}
}


func (h *MediaHandler) getExtension(contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".jpg"
	}
}

func (h *MediaHandler) isValidFilename(filename string) bool {
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		return false
	}

	ext := strings.ToLower(filepath.Ext(filename))
	allowedExts := []string{".jpg", ".jpeg", ".png", ".webp", ".gif"}
	for _, allowed := range allowedExts {
		if ext == allowed {
			return true
		}
	}
	
	return false
}

func (h *MediaHandler) serveDefaultAvatar(c *gin.Context) {
	svg := `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
	<rect width="100" height="100" rx="20" fill="#f0f0f0"/>
	<path d="M50,35 A15,15 0 1,1 50,65 A15,15 0 1,1 50,35 M30,75 Q50,85 70,75" 
		  stroke="#666" stroke-width="3" fill="none"/>
</svg>`
	
	c.Header("Content-Type", "image/svg+xml")
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.String(http.StatusOK, svg)
}

func (h *MediaHandler) deleteThumbnails(filename string) {
	baseName := strings.TrimSuffix(filename, filepath.Ext(filename))
	patterns := []string{
		baseName + "_thumb.jpg",
		baseName + "_small.jpg", 
		baseName + "_medium.jpg",
	}
	
	for _, pattern := range patterns {
		path := filepath.Join(h.uploadDir, pattern)
		os.Remove(path)
		h.fileCache.Delete(pattern)
	}
}

type AvatarResponse struct {
	AvatarURL string `json:"avatar_url"`
	Filename  string `json:"filename"`
	Size      int64  `json:"size"`
	Duration  int64  `json:"duration_ms"`
}