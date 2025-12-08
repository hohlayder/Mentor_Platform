CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_mentorship_slots_status 
        CHECK (status IN ('available', 'booked', 'closed')),
    CONSTRAINT check_price_non_negative 
        CHECK (price >= 0)
);

CREATE OR REPLACE FUNCTION check_no_overlapping_slots()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM slots 
        WHERE mentor_id = NEW.mentor_id
        AND status IN ('available', 'booked')
        AND tstzrange(start_time, start_time + (duration_minutes * interval '1 minute')) 
            && tstzrange(NEW.start_time, NEW.start_time + (NEW.duration_minutes * interval '1 minute'))
        AND id != NEW.id  
    ) THEN
        RAISE EXCEPTION 'Overlapping time slot for mentor %', NEW.mentor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_no_overlap
    BEFORE INSERT OR UPDATE ON slots
    FOR EACH ROW
    EXECUTE FUNCTION check_no_overlapping_slots();


CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL UNIQUE,
    student_id UUID NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_mentorship_sessions_slot 
        FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
);
