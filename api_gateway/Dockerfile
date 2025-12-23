FROM golang:1.24.3-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

RUN go install github.com/swaggo/swag/cmd/swag@latest

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN swag init -g ./cmd/api_gateway/main.go --parseDependency --parseInternal

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api_gateway

FROM alpine:latest

RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

RUN apk --no-cache add ca-certificates tzdata

RUN mkdir -p /home/appuser/uploads/avatars && \
    chown -R appuser:appuser /home/appuser/uploads
    
WORKDIR /home/appuser/

COPY --from=builder --chown=appuser:appuser /app/main .
COPY --from=builder --chown=appuser:appuser /app/docs ./docs

RUN chown -R appuser:appuser /home/appuser/

USER appuser

EXPOSE 8080

CMD ["./main"]
