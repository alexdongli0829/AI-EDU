"""
Data access repositories for Background Jobs
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text


class ChatRepository:
    """Repository for chat_sessions and chat_messages tables"""

    def __init__(self, db: Session):
        self.db = db

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get chat session by ID"""
        query = text("""
            SELECT
                id, student_id, parent_id, status,
                started_at, ended_at, message_count,
                created_at, updated_at
            FROM chat_sessions
            WHERE id = :session_id
        """)

        result = self.db.execute(query, {"session_id": session_id}).fetchone()

        if result:
            return {
                "id": result[0],
                "student_id": result[1],
                "parent_id": result[2],
                "status": result[3],
                "started_at": result[4],
                "ended_at": result[5],
                "message_count": result[6],
                "created_at": result[7],
                "updated_at": result[8]
            }
        return None

    def get_session_messages(
        self,
        session_id: str,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """Get all messages for a session"""
        if limit:
            query = text("""
                SELECT
                    id, role, content, token_count, created_at
                FROM chat_messages
                WHERE session_id = :session_id
                ORDER BY created_at ASC
                LIMIT :limit
            """)
            params = {"session_id": session_id, "limit": limit}
        else:
            query = text("""
                SELECT
                    id, role, content, token_count, created_at
                FROM chat_messages
                WHERE session_id = :session_id
                ORDER BY created_at ASC
            """)
            params = {"session_id": session_id}

        results = self.db.execute(query, params).fetchall()

        return [
            {
                "id": r[0],
                "role": r[1],
                "content": r[2],
                "token_count": r[3],
                "created_at": r[4]
            }
            for r in results
        ]

    def get_recent_sessions(
        self,
        student_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """Get recent completed sessions for a student"""
        query = text("""
            SELECT
                id, started_at, ended_at, message_count
            FROM chat_sessions
            WHERE student_id = :student_id
                AND status = 'ended'
            ORDER BY ended_at DESC
            LIMIT :limit
        """)

        results = self.db.execute(
            query,
            {"student_id": student_id, "limit": limit}
        ).fetchall()

        return [
            {
                "id": r[0],
                "started_at": r[1],
                "ended_at": r[2],
                "message_count": r[3]
            }
            for r in results
        ]

    def get_sessions_without_summary(self, limit: int = 100) -> List[str]:
        """
        Get session IDs that don't have summaries yet

        Looks for ended sessions with no corresponding conversation_memory entry
        """
        query = text("""
            SELECT cs.id
            FROM chat_sessions cs
            LEFT JOIN conversation_memory cm ON cs.id = cm.session_id
            WHERE cs.status = 'ended'
                AND cs.ended_at IS NOT NULL
                AND cm.id IS NULL
                AND cs.message_count > 3
            ORDER BY cs.ended_at ASC
            LIMIT :limit
        """)

        results = self.db.execute(query, {"limit": limit}).fetchall()
        return [r[0] for r in results]


class ConversationMemoryRepository:
    """Repository for conversation_memory table"""

    def __init__(self, db: Session):
        self.db = db

    def create_memory(
        self,
        session_id: str,
        student_id: str,
        summary_text: str,
        topics_discussed: List[str],
        key_points: List[str]
    ) -> str:
        """Create a new conversation memory entry"""
        query = text("""
            INSERT INTO conversation_memory (
                session_id, student_id, summary_text,
                topics_discussed, key_points, created_at
            ) VALUES (
                :session_id, :student_id, :summary_text,
                :topics_discussed, :key_points, NOW()
            )
            RETURNING id
        """)

        result = self.db.execute(query, {
            "session_id": session_id,
            "student_id": student_id,
            "summary_text": summary_text,
            "topics_discussed": topics_discussed,
            "key_points": key_points
        }).fetchone()

        return result[0]

    def get_recent_memories(
        self,
        student_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """Get recent conversation memories for a student"""
        query = text("""
            SELECT
                id, session_id, summary_text,
                topics_discussed, key_points, created_at
            FROM conversation_memory
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
                "summary_text": r[2],
                "topics_discussed": r[3],
                "key_points": r[4],
                "created_at": r[5]
            }
            for r in results
        ]

    def get_memories_since(
        self,
        student_id: str,
        since: datetime,
        limit: int = 10
    ) -> List[Dict]:
        """Get conversation memories since a specific date"""
        query = text("""
            SELECT
                id, session_id, summary_text,
                topics_discussed, key_points, created_at
            FROM conversation_memory
            WHERE student_id = :student_id
                AND created_at >= :since
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        results = self.db.execute(
            query,
            {"student_id": student_id, "since": since, "limit": limit}
        ).fetchall()

        return [
            {
                "id": r[0],
                "session_id": r[1],
                "summary_text": r[2],
                "topics_discussed": r[3],
                "key_points": r[4],
                "created_at": r[5]
            }
            for r in results
        ]

    def memory_exists(self, session_id: str) -> bool:
        """Check if memory already exists for a session"""
        query = text("""
            SELECT COUNT(*)
            FROM conversation_memory
            WHERE session_id = :session_id
        """)

        result = self.db.execute(query, {"session_id": session_id}).fetchone()
        return result[0] > 0
