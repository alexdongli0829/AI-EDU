"""
Data access repositories for Profile Engine
"""

from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text


class TestSessionRepository:
    """Repository for test_sessions table"""

    def __init__(self, db: Session):
        self.db = db

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get test session by ID"""
        query = text("""
            SELECT
                id, student_id, test_id, status,
                started_at, completed_at, time_remaining,
                current_question_index, total_questions, score
            FROM test_sessions
            WHERE id = :session_id
        """)

        result = self.db.execute(query, {"session_id": session_id}).fetchone()

        if result:
            return {
                "id": result[0],
                "student_id": result[1],
                "test_id": result[2],
                "status": result[3],
                "started_at": result[4],
                "completed_at": result[5],
                "time_remaining": result[6],
                "current_question_index": result[7],
                "total_questions": result[8],
                "score": result[9]
            }
        return None

    def get_student_sessions(
        self,
        student_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """Get recent test sessions for a student"""
        query = text("""
            SELECT
                id, test_id, status, completed_at, score
            FROM test_sessions
            WHERE student_id = :student_id
                AND status = 'completed'
            ORDER BY completed_at DESC
            LIMIT :limit
        """)

        results = self.db.execute(
            query,
            {"student_id": student_id, "limit": limit}
        ).fetchall()

        return [
            {
                "id": r[0],
                "test_id": r[1],
                "status": r[2],
                "completed_at": r[3],
                "score": r[4]
            }
            for r in results
        ]


class SessionResponseRepository:
    """Repository for session_responses table"""

    def __init__(self, db: Session):
        self.db = db

    def get_session_responses(self, session_id: str) -> List[Dict]:
        """Get all responses for a session with question details"""
        query = text("""
            SELECT
                sr.id,
                sr.question_id,
                sr.student_answer,
                sr.correct_answer,
                sr.is_correct,
                sr.time_spent,
                sr.answered_at,
                q.question_type,
                q.estimated_time_seconds,
                q.skill_tags
            FROM session_responses sr
            JOIN questions q ON sr.question_id = q.id
            WHERE sr.session_id = :session_id
            ORDER BY sr.answered_at ASC
        """)

        results = self.db.execute(
            query,
            {"session_id": session_id}
        ).fetchall()

        return [
            {
                "id": r[0],
                "question_id": r[1],
                "student_answer": r[2],
                "correct_answer": r[3],
                "is_correct": r[4],
                "time_spent": r[5],
                "answered_at": r[6],
                "question_type": r[7],
                "estimated_time": r[8],
                "skill_tags": r[9] or []
            }
            for r in results
        ]

    def get_student_responses(
        self,
        student_id: str,
        skill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get student responses across all sessions, optionally filtered by skill"""

        if skill_id:
            query = text("""
                SELECT
                    sr.id,
                    sr.session_id,
                    sr.question_id,
                    sr.student_answer,
                    sr.correct_answer,
                    sr.is_correct,
                    sr.time_spent,
                    sr.answered_at,
                    q.question_type,
                    q.estimated_time_seconds,
                    q.skill_tags
                FROM session_responses sr
                JOIN questions q ON sr.question_id = q.id
                JOIN test_sessions ts ON sr.session_id = ts.id
                WHERE ts.student_id = :student_id
                    AND :skill_id = ANY(q.skill_tags)
                    AND ts.status = 'completed'
                ORDER BY sr.answered_at DESC
                LIMIT :limit
            """)
            params = {"student_id": student_id, "skill_id": skill_id, "limit": limit}
        else:
            query = text("""
                SELECT
                    sr.id,
                    sr.session_id,
                    sr.question_id,
                    sr.student_answer,
                    sr.correct_answer,
                    sr.is_correct,
                    sr.time_spent,
                    sr.answered_at,
                    q.question_type,
                    q.estimated_time_seconds,
                    q.skill_tags
                FROM session_responses sr
                JOIN questions q ON sr.question_id = q.id
                JOIN test_sessions ts ON sr.session_id = ts.id
                WHERE ts.student_id = :student_id
                    AND ts.status = 'completed'
                ORDER BY sr.answered_at DESC
                LIMIT :limit
            """)
            params = {"student_id": student_id, "limit": limit}

        results = self.db.execute(query, params).fetchall()

        return [
            {
                "id": r[0],
                "session_id": r[1],
                "question_id": r[2],
                "student_answer": r[3],
                "correct_answer": r[4],
                "is_correct": r[5],
                "time_spent": r[6],
                "answered_at": r[7],
                "question_type": r[8],
                "estimated_time": r[9],
                "skill_tags": r[10] or []
            }
            for r in results
        ]


class StudentProfileRepository:
    """Repository for student_profiles table"""

    def __init__(self, db: Session):
        self.db = db

    def get_profile(self, student_id: str) -> Optional[Dict]:
        """Get current student profile"""
        query = text("""
            SELECT
                student_id, skill_graph, error_patterns,
                time_behavior, overall_mastery, strengths,
                weaknesses, last_calculated
            FROM student_profiles
            WHERE student_id = :student_id
        """)

        result = self.db.execute(
            query,
            {"student_id": student_id}
        ).fetchone()

        if result:
            return {
                "student_id": result[0],
                "skill_graph": result[1],
                "error_patterns": result[2],
                "time_behavior": result[3],
                "overall_mastery": result[4],
                "strengths": result[5],
                "weaknesses": result[6],
                "last_calculated": result[7]
            }
        return None

    def upsert_profile(
        self,
        student_id: str,
        skill_graph: List[Dict],
        error_patterns: List[Dict],
        time_behavior: Dict,
        overall_mastery: float,
        strengths: List[str],
        weaknesses: List[str]
    ) -> None:
        """Insert or update student profile"""
        query = text("""
            INSERT INTO student_profiles (
                student_id, skill_graph, error_patterns,
                time_behavior, overall_mastery, strengths,
                weaknesses, last_calculated
            ) VALUES (
                :student_id, :skill_graph, :error_patterns,
                :time_behavior, :overall_mastery, :strengths,
                :weaknesses, NOW()
            )
            ON CONFLICT (student_id) DO UPDATE SET
                skill_graph = EXCLUDED.skill_graph,
                error_patterns = EXCLUDED.error_patterns,
                time_behavior = EXCLUDED.time_behavior,
                overall_mastery = EXCLUDED.overall_mastery,
                strengths = EXCLUDED.strengths,
                weaknesses = EXCLUDED.weaknesses,
                last_calculated = NOW()
        """)

        self.db.execute(query, {
            "student_id": student_id,
            "skill_graph": skill_graph,
            "error_patterns": error_patterns,
            "time_behavior": time_behavior,
            "overall_mastery": overall_mastery,
            "strengths": strengths,
            "weaknesses": weaknesses
        })


class ProfileSnapshotRepository:
    """Repository for profile_snapshots table"""

    def __init__(self, db: Session):
        self.db = db

    def create_snapshot(
        self,
        student_id: str,
        session_id: str,
        snapshot_data: Dict
    ) -> str:
        """Create a new profile snapshot"""
        query = text("""
            INSERT INTO profile_snapshots (
                student_id, session_id, snapshot_data, created_at
            ) VALUES (
                :student_id, :session_id, :snapshot_data, NOW()
            )
            RETURNING id
        """)

        result = self.db.execute(query, {
            "student_id": student_id,
            "session_id": session_id,
            "snapshot_data": snapshot_data
        }).fetchone()

        return result[0]

    def get_snapshots(
        self,
        student_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """Get recent profile snapshots"""
        query = text("""
            SELECT
                id, session_id, snapshot_data, created_at
            FROM profile_snapshots
            WHERE student_id = :student_id
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        results = self.db.execute(
            query,
            {"student_id": student_id, "limit": limit}
        ).fetchall()

        return [
            {
                "id": r[0],
                "session_id": r[1],
                "snapshot_data": r[2],
                "created_at": r[3]
            }
            for r in results
        ]
