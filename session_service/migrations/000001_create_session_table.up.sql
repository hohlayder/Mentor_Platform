CREATE TABLE slot_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE slots (
    id BIGSERIAL PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    status_id INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_mentorship_slots_status 
        FOREIGN KEY (status_id) REFERENCES slot_statuses(id),

    CONSTRAINT no_overlapping_slots 
        EXCLUDE USING gist (
            mentor_id WITH =,
            tstzrange(start_time, start_time + (duration_minutes || ' minutes')::interval) WITH &&
        )
);

CREATE TABLE sessions (
    id BIGSERIAL PRIMARY KEY,
    slot_id BIGINT NOT NULL UNIQUE,
    student_id BIGINT NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_mentorship_sessions_slot 
        FOREIGN KEY (slot_id) REFERENCES mentorship_slots(id) ON DELETE CASCADE
);