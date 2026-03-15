"""
Time Behavior Analyzer
Analyzes student's time management and response speed patterns
"""

import numpy as np
from typing import List, Dict, Tuple
from ..models.skill_node import TimeBehavior


class TimeAnalyzer:
    """
    Analyzes time-based behavior patterns

    Metrics:
    - Average speed (seconds per question)
    - Rushing indicator (responding too quickly)
    - Hesitation pattern (responding too slowly)
    - Optimal time range for this student
    """

    def __init__(
        self,
        rushing_threshold: float = 0.5,  # 50% of estimated time
        hesitation_threshold: float = 2.0,  # 200% of estimated time
    ):
        """
        Initialize time analyzer

        Args:
            rushing_threshold: Multiplier for "rushing" detection
            hesitation_threshold: Multiplier for "hesitation" detection
        """
        self.rushing_threshold = rushing_threshold
        self.hesitation_threshold = hesitation_threshold

    def analyze_time_behavior(
        self,
        responses: List[Dict]
    ) -> TimeBehavior:
        """
        Analyze time behavior from responses

        Args:
            responses: List of response dictionaries with:
                - time_spent: int (seconds)
                - estimated_time: int (seconds)
                - skill_tags: List[str]
                - is_correct: bool

        Returns:
            TimeBehavior object
        """
        if not responses:
            return TimeBehavior(
                average_speed=60.0,
                rushing_indicator=0.0,
                hesitation_pattern=[],
                optimal_time_range={"min": 30, "max": 120}
            )

        # Calculate average speed
        times = [r["time_spent"] for r in responses]
        average_speed = float(np.mean(times))

        # Calculate rushing indicator
        rushing_indicator = self._calculate_rushing_indicator(responses)

        # Identify hesitation patterns
        hesitation_pattern = self._identify_hesitation_patterns(responses)

        # Calculate optimal time range (25th to 75th percentile of correct responses)
        optimal_range = self._calculate_optimal_range(responses)

        return TimeBehavior(
            average_speed=average_speed,
            rushing_indicator=rushing_indicator,
            hesitation_pattern=hesitation_pattern,
            optimal_time_range=optimal_range
        )

    def _calculate_rushing_indicator(
        self,
        responses: List[Dict]
    ) -> float:
        """
        Calculate indicator of rushing behavior

        Returns:
            Float 0-1 where 1 = rushing, 0 = not rushing
        """
        rushing_count = 0

        for response in responses:
            time_spent = response["time_spent"]
            estimated_time = response["estimated_time"]

            # Check if response was rushed
            if time_spent < estimated_time * self.rushing_threshold:
                rushing_count += 1

        if not responses:
            return 0.0

        rushing_ratio = rushing_count / len(responses)

        # Also consider if rushed answers are incorrect (stronger signal)
        rushed_and_wrong = sum(
            1 for r in responses
            if r["time_spent"] < r["estimated_time"] * self.rushing_threshold
            and not r["is_correct"]
        )

        if rushing_count > 0:
            accuracy_penalty = rushed_and_wrong / rushing_count
        else:
            accuracy_penalty = 0.0

        # Combine ratio and accuracy penalty
        rushing_indicator = (rushing_ratio * 0.7) + (accuracy_penalty * 0.3)

        return float(np.clip(rushing_indicator, 0.0, 1.0))

    def _identify_hesitation_patterns(
        self,
        responses: List[Dict]
    ) -> List[str]:
        """
        Identify skills where student shows hesitation (unusually slow)

        Returns:
            List of skill IDs where hesitation is observed
        """
        # Group responses by skill
        skill_times = {}

        for response in responses:
            time_ratio = response["time_spent"] / response["estimated_time"]

            for skill in response["skill_tags"]:
                if skill not in skill_times:
                    skill_times[skill] = []
                skill_times[skill].append(time_ratio)

        # Identify skills with consistently high time ratios
        hesitation_skills = []

        for skill, ratios in skill_times.items():
            if len(ratios) >= 2:  # Need at least 2 data points
                avg_ratio = np.mean(ratios)

                if avg_ratio > self.hesitation_threshold:
                    hesitation_skills.append(skill)

        return hesitation_skills

    def _calculate_optimal_range(
        self,
        responses: List[Dict]
    ) -> Dict[str, int]:
        """
        Calculate optimal time range for this student

        Uses correct responses to determine when student performs best

        Returns:
            Dictionary with min and max time in seconds
        """
        # Get times for correct responses only
        correct_times = [
            r["time_spent"] for r in responses if r["is_correct"]
        ]

        if len(correct_times) < 3:
            # Not enough data, use default
            return {"min": 30, "max": 120}

        # Use 25th and 75th percentiles
        min_time = int(np.percentile(correct_times, 25))
        max_time = int(np.percentile(correct_times, 75))

        # Ensure reasonable bounds
        min_time = max(10, min_time)  # At least 10 seconds
        max_time = min(300, max_time)  # At most 5 minutes

        # Ensure min < max
        if min_time >= max_time:
            max_time = min_time + 30

        return {"min": min_time, "max": max_time}

    def get_time_recommendations(
        self,
        time_behavior: TimeBehavior
    ) -> List[str]:
        """
        Generate recommendations based on time behavior

        Args:
            time_behavior: TimeBehavior object

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Rushing indicator
        if time_behavior.rushing_indicator > 0.6:
            recommendations.append(
                "Slow down! You're answering too quickly. Take time to read questions carefully."
            )
        elif time_behavior.rushing_indicator > 0.3:
            recommendations.append(
                "Consider spending more time on each question to avoid careless mistakes."
            )

        # Hesitation patterns
        if time_behavior.hesitation_pattern:
            skills_str = ", ".join(time_behavior.hesitation_pattern[:3])
            recommendations.append(
                f"Practice {skills_str} to build confidence and speed."
            )

        # Optimal time range
        optimal = time_behavior.optimal_time_range
        if time_behavior.average_speed < optimal["min"]:
            recommendations.append(
                f"You perform best when spending {optimal['min']}-{optimal['max']} seconds per question."
            )
        elif time_behavior.average_speed > optimal["max"]:
            recommendations.append(
                "Try to work more efficiently. Practice with timed exercises."
            )

        return recommendations

    def compare_with_peers(
        self,
        student_speed: float,
        peer_speeds: List[float]
    ) -> Dict[str, any]:
        """
        Compare student's speed with peers

        Args:
            student_speed: Student's average speed (seconds)
            peer_speeds: List of peer average speeds

        Returns:
            Dictionary with comparison metrics
        """
        if not peer_speeds:
            return {
                "percentile": 50,
                "faster_than": 50,
                "status": "average"
            }

        # Calculate percentile
        percentile = (
            sum(1 for speed in peer_speeds if speed > student_speed) /
            len(peer_speeds) * 100
        )

        # Determine status
        if percentile >= 75:
            status = "fast"
        elif percentile >= 40:
            status = "average"
        else:
            status = "slow"

        return {
            "percentile": round(percentile, 1),
            "faster_than": round(percentile, 1),
            "status": status,
            "peer_avg": round(np.mean(peer_speeds), 1),
            "student_avg": round(student_speed, 1)
        }


# Example usage
if __name__ == "__main__":
    analyzer = TimeAnalyzer()

    # Example responses
    responses = [
        {
            "time_spent": 45,
            "estimated_time": 60,
            "skill_tags": ["reading.inference"],
            "is_correct": True
        },
        {
            "time_spent": 25,
            "estimated_time": 60,
            "skill_tags": ["reading.main-idea"],
            "is_correct": False
        },
        {
            "time_spent": 150,
            "estimated_time": 60,
            "skill_tags": ["math.word-problems"],
            "is_correct": False
        },
        {
            "time_spent": 55,
            "estimated_time": 60,
            "skill_tags": ["reading.vocabulary"],
            "is_correct": True
        },
    ]

    # Analyze
    behavior = analyzer.analyze_time_behavior(responses)

    print(f"Average Speed: {behavior.average_speed:.1f} seconds")
    print(f"Rushing Indicator: {behavior.rushing_indicator:.2f}")
    print(f"Hesitation Pattern: {behavior.hesitation_pattern}")
    print(f"Optimal Range: {behavior.optimal_time_range}")

    # Get recommendations
    recommendations = analyzer.get_time_recommendations(behavior)
    print(f"\nRecommendations:")
    for rec in recommendations:
        print(f"  - {rec}")

    # Compare with peers
    peer_comparison = analyzer.compare_with_peers(
        student_speed=behavior.average_speed,
        peer_speeds=[50, 60, 70, 80, 90, 100]
    )
    print(f"\nPeer Comparison:")
    print(f"  Status: {peer_comparison['status']}")
    print(f"  Faster than: {peer_comparison['faster_than']:.1f}% of peers")
