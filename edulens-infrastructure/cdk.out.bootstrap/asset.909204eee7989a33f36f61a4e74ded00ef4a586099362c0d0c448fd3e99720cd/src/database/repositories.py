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
        stage_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get student responses across all sessions, optionally filtered by skill and/or stage"""
        params: Dict = {"student_id": student_id, "limit": limit}
        stage_join = ""
        extra_where = ""

        if stage_id:
            stage_join = "JOIN student_stages ss ON ts.student_stage_id = ss.id"
            extra_where += " AND ss.stage_id = :stage_id"
            params["stage_id"] = stage_id

        if skill_id:
            extra_where += " AND :skill_id = ANY(q.skill_tags)"
            params["skill_id"] = skill_id

        sql = f"""
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
            {stage_join}
            WHERE ts.student_id = :student_id
                AND ts.status = 'completed'
                {extra_where}
            ORDER BY sr.answered_at DESC
            LIMIT :limit
        """

        results = self.db.execute(text(sql), params).fetchall()

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


class StudentStageRepository:
    """Repository for student_stages table (Stage Layer of Learning DNA)"""

    def __init__(self, db: Session):
        self.db = db

    def get_active_stage(self, student_id: str) -> Optional[Dict]:
        """Get the student's current active stage enrollment"""
        query = text("""
            SELECT id, student_id, stage_id, status, stage_profile, activated_at
            FROM student_stages
            WHERE student_id = :student_id AND status = 'active'
            ORDER BY activated_at DESC
            LIMIT 1
        """)
        result = self.db.execute(query, {"student_id": student_id}).fetchone()
        if result:
            return {
                "id": str(result[0]),
                "student_id": str(result[1]),
                "stage_id": result[2],
                "status": result[3],
                "stage_profile": result[4] or {},
                "activated_at": result[5],
            }
        return None

    def get_stage_enrollment(self, student_id: str, stage_id: str) -> Optional[Dict]:
        """Get a specific stage enrollment"""
        query = text("""
            SELECT id, student_id, stage_id, status, stage_profile, activated_at
            FROM student_stages
            WHERE student_id = :student_id AND stage_id = :stage_id
        """)
        result = self.db.execute(query, {"student_id": student_id, "stage_id": stage_id}).fetchone()
        if result:
            return {
                "id": str(result[0]),
                "student_id": str(result[1]),
                "stage_id": result[2],
                "status": result[3],
                "stage_profile": result[4] or {},
                "activated_at": result[5],
            }
        return None

    def upsert_stage_profile(
        self,
        student_id: str,
        stage_id: str,
        skill_graph: List[Dict],
        overall_mastery: float,
        strengths: List[str],
        weaknesses: List[str],
        stage_error_stats: Dict,
    ) -> None:
        """Write the Stage Layer profile for a specific stage enrollment"""
        stage_profile = {
            "skill_graph": skill_graph,
            "overall_mastery": overall_mastery,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "stage_error_stats": stage_error_stats,
        }
        query = text("""
            UPDATE student_stages
            SET stage_profile = :stage_profile::jsonb, updated_at = NOW()
            WHERE student_id = :student_id AND stage_id = :stage_id
        """)
        import json as _json
        self.db.execute(query, {
            "student_id": student_id,
            "stage_id": stage_id,
            "stage_profile": _json.dumps(stage_profile),
        })

    def get_stage_error_stats(self, student_id: str, stage_id: str) -> Dict:
        """Get stage-specific error distribution from stage_profile"""
        query = text("""
            SELECT stage_profile->'stage_error_stats' as stats
            FROM student_stages
            WHERE student_id = :student_id AND stage_id = :stage_id
        """)
        result = self.db.execute(query, {"student_id": student_id, "stage_id": stage_id}).fetchone()
        if result and result[0]:
            return result[0]
        return {}


class CoreProfileRepository:
    """Repository for students.core_profile (Core Layer of Learning DNA)"""

    def __init__(self, db: Session):
        self.db = db

    def get_core_profile(self, student_id: str) -> Dict:
        """Get the student's core profile"""
        query = text("""
            SELECT core_profile FROM students WHERE id = :student_id
        """)
        result = self.db.execute(query, {"student_id": student_id}).fetchone()
        if result and result[0]:
            return result[0]
        return {}

    def update_error_profile(
        self,
        student_id: str,
        error_patterns: List[Dict],
        time_behavior: Dict,
    ) -> None:
        """Update the lifetime error_patterns and time_behavior in core_profile"""
        import json as _json
        query = text("""
            UPDATE students
            SET core_profile = COALESCE(core_profile, '{}'::jsonb)
                || jsonb_build_object(
                    'error_patterns', :error_patterns::jsonb,
                    'time_behavior',  :time_behavior::jsonb
                )
            WHERE id = :student_id
        """)
        self.db.execute(query, {
            "student_id": student_id,
            "error_patterns": _json.dumps(error_patterns),
            "time_behavior": _json.dumps(time_behavior),
        })

    def update_competitive_performance(
        self,
        student_id: str,
        contests_participated: int,
        avg_percentile: float,
        percentile_trend: str,
        history_entry: Dict,
    ) -> None:
        """Append a contest result to core_profile.competitive_performance"""
        import json as _json
        query = text("""
            UPDATE students
            SET core_profile = jsonb_set(
                COALESCE(core_profile, '{}'::jsonb),
                '{competitive_performance}',
                jsonb_build_object(
                    'contests_participated', :contests_participated,
                    'avg_percentile', :avg_percentile,
                    'percentile_trend', :percentile_trend,
                    'history', COALESCE(
                        core_profile->'competitive_performance'->'history', '[]'::jsonb
                    ) || :history_entry::jsonb
                )
            )
            WHERE id = :student_id
        """)
        self.db.execute(query, {
            "student_id": student_id,
            "contests_participated": contests_participated,
            "avg_percentile": avg_percentile,
            "percentile_trend": percentile_trend,
            "history_entry": _json.dumps([history_entry]),
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
