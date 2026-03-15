"""
Error Pattern Classifier
Identifies and categorizes recurring error patterns
"""

from typing import List, Dict, Tuple
from datetime import datetime
from collections import defaultdict
from ..models.skill_node import ErrorPattern


class ErrorClassifier:
    """
    Classifies and tracks error patterns in student responses

    Error Types:
    - misread_question: Student misunderstood the question
    - calculation_error: Mathematical calculation mistake
    - careless_mistake: Simple oversight or typo
    - conceptual_gap: Missing fundamental understanding
    - time_pressure: Rushed answer due to time constraint
    - partial_understanding: Got partway but incomplete
    """

    ERROR_TYPES = [
        "misread_question",
        "calculation_error",
        "careless_mistake",
        "conceptual_gap",
        "time_pressure",
        "partial_understanding",
        "unknown"
    ]

    def __init__(
        self,
        frequency_threshold: int = 3,
        severity_thresholds: Dict[str, int] = None
    ):
        """
        Initialize error classifier

        Args:
            frequency_threshold: Minimum occurrences to flag as pattern
            severity_thresholds: Thresholds for error severity levels
        """
        self.frequency_threshold = frequency_threshold
        self.severity_thresholds = severity_thresholds or {
            "low": 3,
            "medium": 5,
            "high": 8
        }

    def classify_error(
        self,
        question_type: str,
        skill_tags: List[str],
        time_spent: int,
        estimated_time: int,
        student_answer: str,
        correct_answer: str
    ) -> str:
        """
        Classify the type of error based on response characteristics

        Args:
            question_type: Type of question (multiple_choice, short_answer, essay)
            skill_tags: Skills tested by the question
            time_spent: Time student spent (seconds)
            estimated_time: Expected time (seconds)
            student_answer: Student's answer
            correct_answer: Correct answer

        Returns:
            Error type classification
        """
        # Careless mistake (very quick but wrong) - check first
        if time_spent < estimated_time * 0.3:
            return "careless_mistake"

        # Time pressure indicator
        if time_spent < estimated_time * 0.5:
            return "time_pressure"

        # For multiple choice, check if answer is close to correct
        if question_type == "multiple_choice":
            # If spent long time and still wrong, likely conceptual gap
            if time_spent > estimated_time * 1.5:
                return "conceptual_gap"
            else:
                return "misread_question"

        # For short answer, analyze the response
        if question_type == "short_answer":
            if self._is_calculation_error(student_answer, correct_answer):
                return "calculation_error"

            if len(student_answer) < len(correct_answer) * 0.5:
                return "partial_understanding"

            # Long time spent suggests conceptual difficulty
            if time_spent > estimated_time * 1.5:
                return "conceptual_gap"

        # Default
        return "unknown"

    def _is_calculation_error(self, student_answer: str, correct_answer: str) -> bool:
        """
        Detect if error is a calculation mistake

        Simple heuristic: check if answers are numerically close
        """
        try:
            student_val = float(student_answer)
            correct_val = float(correct_answer)

            # If within 20% but wrong, likely calculation error
            diff_percent = abs(student_val - correct_val) / correct_val
            return 0.05 < diff_percent < 0.20

        except (ValueError, ZeroDivisionError):
            return False

    def aggregate_error_patterns(
        self,
        responses: List[Dict]
    ) -> List[ErrorPattern]:
        """
        Aggregate individual errors into patterns

        Args:
            responses: List of incorrect response dictionaries with:
                - error_type: str
                - skill_tags: List[str]
                - question_id: str
                - timestamp: datetime

        Returns:
            List of ErrorPattern objects
        """
        # Group by error type
        error_groups = defaultdict(list)

        for response in responses:
            error_type = response.get("error_type", "unknown")
            error_groups[error_type].append(response)

        # Create ErrorPattern objects
        patterns = []

        for error_type, occurrences in error_groups.items():
            if len(occurrences) < self.frequency_threshold:
                continue  # Not frequent enough to be a pattern

            # Collect affected skills
            skills_affected = set()
            examples = []
            timestamps = []

            for occurrence in occurrences:
                skills_affected.update(occurrence.get("skill_tags", []))
                examples.append(occurrence.get("question_id", ""))
                timestamps.append(occurrence.get("timestamp", datetime.utcnow()))

            # Determine severity
            frequency = len(occurrences)
            severity = self._calculate_severity(frequency)

            pattern = ErrorPattern(
                error_type=error_type,
                frequency=frequency,
                skills_affected=list(skills_affected),
                examples=examples[:5],  # Keep max 5 examples
                severity=severity,
                first_seen=min(timestamps),
                last_seen=max(timestamps)
            )

            patterns.append(pattern)

        # Sort by severity and frequency
        patterns.sort(
            key=lambda p: (
                self._severity_rank(p.severity),
                p.frequency
            ),
            reverse=True
        )

        return patterns

    def _calculate_severity(self, frequency: int) -> str:
        """
        Calculate severity level based on frequency

        Args:
            frequency: Number of occurrences

        Returns:
            Severity level: 'low', 'medium', or 'high'
        """
        if frequency >= self.severity_thresholds["high"]:
            return "high"
        elif frequency >= self.severity_thresholds["medium"]:
            return "medium"
        else:
            return "low"

    def _severity_rank(self, severity: str) -> int:
        """Convert severity to numeric rank for sorting"""
        return {"high": 3, "medium": 2, "low": 1}.get(severity, 0)

    def get_recommendations(self, patterns: List[ErrorPattern]) -> List[str]:
        """
        Generate recommendations based on error patterns

        Args:
            patterns: List of ErrorPattern objects

        Returns:
            List of recommendation strings
        """
        recommendations = []

        for pattern in patterns:
            if pattern.severity == "high":
                if pattern.error_type == "conceptual_gap":
                    recommendations.append(
                        f"Focus on fundamental concepts in {', '.join(pattern.skills_affected[:2])}. "
                        "Consider reviewing prerequisite material."
                    )
                elif pattern.error_type == "time_pressure":
                    recommendations.append(
                        "Practice time management. Work on accuracy before speed."
                    )
                elif pattern.error_type == "calculation_error":
                    recommendations.append(
                        "Slow down on calculations. Consider using estimation to check answers."
                    )
                elif pattern.error_type == "misread_question":
                    recommendations.append(
                        "Take time to carefully read questions. Underline key words."
                    )

        return recommendations[:5]  # Return top 5 recommendations

    def track_error_trends(
        self,
        historical_patterns: List[ErrorPattern],
        current_patterns: List[ErrorPattern]
    ) -> Dict[str, str]:
        """
        Compare historical vs current patterns to identify trends

        Args:
            historical_patterns: Previous error patterns
            current_patterns: Recent error patterns

        Returns:
            Dictionary of trends: {error_type: "improving"|"stable"|"worsening"}
        """
        trends = {}

        # Create lookup dictionaries
        historical_freq = {p.error_type: p.frequency for p in historical_patterns}
        current_freq = {p.error_type: p.frequency for p in current_patterns}

        # Compare frequencies
        all_error_types = set(historical_freq.keys()) | set(current_freq.keys())

        for error_type in all_error_types:
            hist_freq = historical_freq.get(error_type, 0)
            curr_freq = current_freq.get(error_type, 0)

            if curr_freq < hist_freq * 0.7:
                trends[error_type] = "improving"
            elif curr_freq > hist_freq * 1.3:
                trends[error_type] = "worsening"
            else:
                trends[error_type] = "stable"

        return trends


# Example usage
if __name__ == "__main__":
    classifier = ErrorClassifier()

    # Example: Classify an error
    error_type = classifier.classify_error(
        question_type="multiple_choice",
        skill_tags=["reading.inference"],
        time_spent=30,
        estimated_time=60,
        student_answer="option-a",
        correct_answer="option-b"
    )
    print(f"Error Type: {error_type}")

    # Example: Aggregate errors into patterns
    responses = [
        {
            "error_type": "misread_question",
            "skill_tags": ["reading.inference"],
            "question_id": "q1",
            "timestamp": datetime.utcnow()
        },
        {
            "error_type": "misread_question",
            "skill_tags": ["reading.main-idea"],
            "question_id": "q5",
            "timestamp": datetime.utcnow()
        },
        {
            "error_type": "misread_question",
            "skill_tags": ["reading.inference"],
            "question_id": "q8",
            "timestamp": datetime.utcnow()
        },
    ]

    patterns = classifier.aggregate_error_patterns(responses)
    print(f"\nError Patterns: {len(patterns)}")
    for pattern in patterns:
        print(f"  - {pattern.error_type}: {pattern.frequency} times, severity={pattern.severity}")

    # Get recommendations
    recommendations = classifier.get_recommendations(patterns)
    print(f"\nRecommendations:")
    for rec in recommendations:
        print(f"  - {rec}")
