"""
Skill Node Model
Represents a single skill in the Learning DNA graph
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SkillNode(BaseModel):
    """
    Represents a skill with Bayesian mastery estimation
    """
    skill_id: str = Field(..., description="Unique skill identifier (e.g., 'reading.inference')")
    skill_name: str = Field(..., description="Human-readable skill name")
    subject: str = Field(..., description="Subject area (math, reading, science, writing)")

    # Bayesian parameters
    mastery_level: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Posterior probability of mastery (0-1)"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Statistical confidence in mastery estimate (0-1)"
    )

    # Evidence counters
    attempts: int = Field(default=0, ge=0, description="Total attempts")
    correct_attempts: int = Field(default=0, ge=0, description="Correct attempts")

    # Beta distribution parameters (Bayesian prior/posterior)
    alpha: float = Field(default=1.0, gt=0, description="Beta distribution alpha (successes + 1)")
    beta: float = Field(default=1.0, gt=0, description="Beta distribution beta (failures + 1)")

    # Timestamps
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "skill_id": "reading.inference",
                "skill_name": "Reading Inference",
                "subject": "reading",
                "mastery_level": 0.75,
                "confidence": 0.82,
                "attempts": 10,
                "correct_attempts": 8,
                "alpha": 9.0,
                "beta": 3.0,
                "last_updated": "2024-01-15T10:30:00Z"
            }
        }


class ErrorPattern(BaseModel):
    """
    Represents a recurring error pattern
    """
    error_type: str = Field(..., description="Type of error (e.g., 'misread_question', 'calculation_error')")
    frequency: int = Field(default=1, ge=1, description="Number of occurrences")
    skills_affected: list[str] = Field(default_factory=list, description="Skills where this error appears")
    examples: list[str] = Field(default_factory=list, description="Example question IDs")
    severity: str = Field(
        default="low",
        pattern="^(low|medium|high)$",
        description="Error severity"
    )
    first_seen: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "error_type": "misread_question",
                "frequency": 5,
                "skills_affected": ["reading.inference", "reading.main-idea"],
                "examples": ["q1", "q5", "q12"],
                "severity": "medium",
                "first_seen": "2024-01-10T10:00:00Z",
                "last_seen": "2024-01-15T14:30:00Z"
            }
        }


class TimeBehavior(BaseModel):
    """
    Represents time-based behavior patterns
    """
    average_speed: float = Field(..., ge=0, description="Average seconds per question")
    rushing_indicator: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Indicator of rushing (1 = rushing, 0 = not rushing)"
    )
    hesitation_pattern: list[str] = Field(
        default_factory=list,
        description="Skills where student shows hesitation (slow response)"
    )
    optimal_time_range: dict = Field(
        default_factory=lambda: {"min": 30, "max": 120},
        description="Optimal time range for this student"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "average_speed": 85.5,
                "rushing_indicator": 0.3,
                "hesitation_pattern": ["math.word-problems", "math.fractions"],
                "optimal_time_range": {"min": 60, "max": 150}
            }
        }


class LearningDNA(BaseModel):
    """
    Complete Learning DNA profile
    """
    student_id: str
    skill_graph: list[SkillNode] = Field(default_factory=list)
    error_patterns: list[ErrorPattern] = Field(default_factory=list)
    time_behavior: Optional[TimeBehavior] = None

    # Overall metrics
    overall_mastery: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Overall mastery across all skills"
    )
    strengths: list[str] = Field(
        default_factory=list,
        description="List of skill IDs where mastery > 0.7"
    )
    weaknesses: list[str] = Field(
        default_factory=list,
        description="List of skill IDs where mastery < 0.5"
    )

    last_calculated: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "student_id": "student-123",
                "overall_mastery": 0.68,
                "strengths": ["reading.vocabulary", "math.arithmetic"],
                "weaknesses": ["math.word-problems", "reading.inference"],
                "last_calculated": "2024-01-15T10:30:00Z"
            }
        }
