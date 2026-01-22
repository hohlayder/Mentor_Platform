def test_session_schema():
    from session_service.schemas.session import SessionCreate

    session = SessionCreate(
        mentor_id=1,
        student_id=2
    )

    assert session.mentor_id == 1