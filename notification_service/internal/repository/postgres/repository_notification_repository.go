package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/domain"
	"github.com/jmoiron/sqlx"
)

type PendingRecipient struct {
    RecipientID    uuid.UUID `db:"recipient_id"`
    NotificationID uuid.UUID `db:"notification_id"`
    ToAddress      *string   `db:"to_address"`
    PushToken      *string   `db:"push_token"`
    PushProvider   *string   `db:"push_provider"`
    UserID         *uuid.UUID `db:"user_id"`
    Attempts       int       `db:"attempts"`
    MaxAttempts    int       `db:"max_attempts"`
    ErrorMessage   *string   `db:"error_message"`

    FromAddress string `db:"from_address"`
    Subject     string `db:"subject"`
    Body        string `db:"body"`
    Type        string `db:"type"`
    Category    *string `db:"category"`
    EntityType  *string `db:"entity_type"`
}

type NotificationRepositoryPostgres struct {
	db *sqlx.DB
}

func NewNotifcationRepositoryPostgres(db *sqlx.DB) *NotificationRepositoryPostgres {
	return &NotificationRepositoryPostgres{db: db}
}


func (r *NotificationRepositoryPostgres) CreateNotification(ctx context.Context, notification *domain.Notification) error {
    tx, err := r.db.BeginTxx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    if err := r.createNotificationWithTx(ctx, tx, notification); err != nil {
        return err
    }

    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    return nil
}

func (r *NotificationRepositoryPostgres) createNotificationWithTx(ctx context.Context, tx *sqlx.Tx, notification *domain.Notification) error {
    query := `
        INSERT INTO notifications (
            from_address, subject, body, status, 
            type, category, entity_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id
    `
    
    err := tx.QueryRowContext(ctx, query,
        notification.FromAddress,
        notification.Subject,
        notification.Body,
        notification.Status,
        notification.Type,
        notification.Category,
        notification.EntityType,
    ).Scan(&notification.ID)
    
    if err != nil {
        return fmt.Errorf("failed to insert notification: %w", err)
    }

    if len(notification.Recipients) > 0 {
        if err := r.createRecipients(ctx, tx, notification.ID, notification.Recipients); err != nil {
            return err
        }
    }

    return nil
}

func (r *NotificationRepositoryPostgres) createRecipients(ctx context.Context, tx *sqlx.Tx, notificationId uuid.UUID, recipients []domain.Recipient) error {
    query := `
        INSERT INTO notification_recipients (
            notification_id, to_address, push_token, push_provider, 
            user_id, attempts, max_attempts, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `

    stmt, err := tx.PrepareContext(ctx, query)
    if err != nil {
        return fmt.Errorf("failed to prepare statement: %w", err)
    }
    defer stmt.Close()

    for _, recipient := range recipients {
        status := recipient.Status
        if status == "" {
            status = domain.NotificationStatusPending
        }

        _, err := stmt.ExecContext(ctx,
            notificationId,
            recipient.ToAddress,
            recipient.PushToken,
            recipient.PushProvider,
            recipient.UserID,
            recipient.Attempts,
            recipient.MaxAttempts,
            status,
            recipient.ErrorMessage,
            recipient.SentAt,
        )
        if err != nil {
            return fmt.Errorf("failed to insert recipient: %w", err)
        }
    }

    return nil
}

func (r *NotificationRepositoryPostgres) GetNotificationById(ctx context.Context, notificationId uuid.UUID) (*domain.Notification, error) {
	var notification domain.Notification
	query := `SELECT * FROM notifications WHERE id=$1`
	err := r.db.GetContext(ctx, &notification, query, notificationId)
	if err != nil {
		return nil, fmt.Errorf("failed to get notification by id: %w", err)
	}

	recipients, err := r.getRecipients(ctx, notificationId)
	if err != nil {
		return nil, err
	}

	notification.Recipients = recipients

	return &notification, nil
}

func (r *NotificationRepositoryPostgres) getRecipients(ctx context.Context, notificationId uuid.UUID) ([]domain.Recipient, error) {
	var recipients []domain.Recipient
	query := `SELECT * FROM notification_recipients WHERE notification_id=$1`

	err := r.db.SelectContext(ctx, &recipients, query, notificationId)
	if err != nil {
		return nil, fmt.Errorf("failed to get recipients: %w", err)
	}


	return recipients, nil
}

func (r *NotificationRepositoryPostgres) DeleteNotification(ctx context.Context, notificationId uuid.UUID) error {
	query := `DELETE FROM notifications WHERE id=$1`

	_, err := r.db.ExecContext(ctx, query, notificationId)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	return nil
}

func (r *NotificationRepositoryPostgres) UpdateNotification(ctx context.Context, notificationUpdate *domain.NotificationUpdate) error {
    tx, err := r.db.BeginTxx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    if err := r.updateNotification(ctx, tx, notificationUpdate); err != nil {
        return err
    }

    if notificationUpdate.Recipients != nil {
        if err := r.updateRecipients(ctx, tx, notificationUpdate.ID, *notificationUpdate.Recipients); err != nil {
            return err
        }
    }

    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    return nil
}

func (r *NotificationRepositoryPostgres) updateNotification(ctx context.Context, tx *sqlx.Tx, notification *domain.NotificationUpdate) error {
    var (
        queryParts []string
        params     []interface{}
        paramCount = 1
    )

    if notification.FromAddress != nil {
        queryParts = append(queryParts, fmt.Sprintf("from_address = $%d", paramCount))
        params = append(params, *notification.FromAddress)
        paramCount++
    }

    if notification.Subject != nil {
        queryParts = append(queryParts, fmt.Sprintf("subject = $%d", paramCount))
        params = append(params, *notification.Subject) 
        paramCount++
    }

    if notification.Body != nil {
        queryParts = append(queryParts, fmt.Sprintf("body = $%d", paramCount))
        params = append(params, *notification.Body)
        paramCount++
    }

    if notification.Status != nil {
        queryParts = append(queryParts, fmt.Sprintf("status = $%d", paramCount))
        params = append(params, *notification.Status) 
        paramCount++
    }

    if notification.Attempts != nil && *notification.Attempts >= 0 {
        queryParts = append(queryParts, fmt.Sprintf("attempts = $%d", paramCount))
        params = append(params, *notification.Attempts)
        paramCount++
    }

    if notification.MaxAttempts != nil && *notification.MaxAttempts >= 0 {
        queryParts = append(queryParts, fmt.Sprintf("max_attempts = $%d", paramCount))
        params = append(params, *notification.MaxAttempts)
        paramCount++
    }

    if notification.Type != nil {
        queryParts = append(queryParts, fmt.Sprintf("type = $%d", paramCount))
        params = append(params, *notification.Type)
        paramCount++
    }

    if notification.Category != nil {
        queryParts = append(queryParts, fmt.Sprintf("category = $%d", paramCount))
        params = append(params, *notification.Category)
        paramCount++
    }

    if notification.EntityType != nil {
        queryParts = append(queryParts, fmt.Sprintf("entity_type = $%d", paramCount))
        params = append(params, *notification.EntityType)
        paramCount++
    }

    queryParts = append(queryParts, "updated_at = NOW()")

    if len(queryParts) == 0 {
        return nil 
    }

    params = append(params, notification.ID)
    whereClause := fmt.Sprintf("WHERE id = $%d", paramCount)

    query := fmt.Sprintf("UPDATE notifications SET %s %s", 
        strings.Join(queryParts, ", "), whereClause)

    result, err := tx.ExecContext(ctx, query, params...)
    if err != nil {
        return fmt.Errorf("failed to update notification: %w", err)
    }

    rowsAffected, err := result.RowsAffected()
    if err == nil && rowsAffected == 0 {
        return fmt.Errorf("notification with id %s not found", notification.ID)
    }

    return nil
}

func (r *NotificationRepositoryPostgres) updateRecipients(ctx context.Context, tx *sqlx.Tx, notificationID uuid.UUID, recipients []domain.Recipient) error {
    if err := r.deleteRecipients(ctx, tx, notificationID); err != nil {
        return err
    }

    if len(recipients) > 0 {
        if err := r.createRecipients(ctx, tx, notificationID, recipients); err != nil {
            return err
        }
    }

    return nil
}

func (r *NotificationRepositoryPostgres) deleteRecipients(ctx context.Context, tx *sqlx.Tx, notificationID uuid.UUID) error {
    query := `DELETE FROM notification_recipients WHERE notification_id = $1`
    _, err := tx.ExecContext(ctx, query, notificationID)
    if err != nil {
        return fmt.Errorf("failed to delete recipients: %w", err)
    }
    return nil
}

func (r *NotificationRepositoryPostgres) GetPendingRecipientsWithNotifications(ctx context.Context, limit int) ([]*PendingRecipient, error) {
    var recipients []*PendingRecipient
    
    query := `
        SELECT 
            nr.id as recipient_id,
            nr.notification_id,
            nr.to_address,
            nr.push_token,
            nr.push_provider,
            nr.user_id,
            nr.attempts,
            nr.max_attempts,
            nr.error_message,
            
            n.from_address,
            n.subject,
            n.body,
            n.type,
            n.category,
            n.entity_type
            
        FROM notification_recipients nr
        INNER JOIN notifications n ON n.id = nr.notification_id
        WHERE nr.status = 'pending'
        AND nr.attempts < nr.max_attempts
        AND n.status != 'completed'
        ORDER BY 
            n.created_at ASC,
            nr.created_at ASC
        LIMIT $1
    `
    
    err := r.db.SelectContext(ctx, &recipients, query, limit)
    if err != nil {
        return nil, fmt.Errorf("failed to get pending recipients with notifications: %w", err)
    }
    
    return recipients, nil
}


func (r *NotificationRepositoryPostgres) UpdateRecipientStatus(ctx context.Context, recipientID uuid.UUID, status string) error {
    query := `
        UPDATE notification_recipients 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
    `
    
    result, err := r.db.ExecContext(ctx, query, status, recipientID)
    if err != nil {
        return fmt.Errorf("failed to update recipient status: %w", err)
    }
    
    rows, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }
    
    if rows == 0 {
        return fmt.Errorf("recipient not found: %s", recipientID)
    }
    
    return nil
}

func (r *NotificationRepositoryPostgres) IncrementRecipientAttempts(ctx context.Context, recipientID uuid.UUID, errorMessage string) error {
    query := `
        UPDATE notification_recipients 
        SET 
            attempts = attempts + 1,
            error_message = $1,
            updated_at = NOW()
        WHERE id = $2
    `
    
    result, err := r.db.ExecContext(ctx, query, errorMessage, recipientID)
    if err != nil {
        return fmt.Errorf("failed to increment recipient attempts: %w", err)
    }
    
    rows, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }
    
    if rows == 0 {
        return fmt.Errorf("recipient not found: %s", recipientID)
    }
    
    return nil
}

func (r *NotificationRepositoryPostgres) MarkRecipientSent(ctx context.Context, recipientID uuid.UUID) error {
    query := `
        UPDATE notification_recipients 
        SET 
            status = 'sent',
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
    `
    
    _, err := r.db.ExecContext(ctx, query, recipientID)
    if err != nil {
        return fmt.Errorf("failed to mark recipient as sent: %w", err)
    }
    
    return nil
}

func (r *NotificationRepositoryPostgres) MarkRecipientFailed(ctx context.Context, recipientID uuid.UUID, errorMessage string) error {
    query := `
        UPDATE notification_recipients 
        SET 
            status = 'failed',
            error_message = $1,
            updated_at = NOW()
        WHERE id = $2
    `
    
    _, err := r.db.ExecContext(ctx, query, errorMessage, recipientID)
    if err != nil {
        return fmt.Errorf("failed to mark recipient as failed: %w", err)
    }
    
    return nil
}