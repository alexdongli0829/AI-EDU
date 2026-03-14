"""
Unit tests for Time Analyzer
"""

import pytest
from src.services.time_analyzer import TimeAnalyzer
from src.models.skill_node import TimeBehavior


class TestTimeAnalyzer:
    """Test suite for time behavior analysis"""

    def setup_method(self):
        """Set up test fixtures"""
        self.analyzer = TimeAnalyzer(
            rushing_threshold=0.5,
            hesitation_threshold=2.0
        )

    def test_empty_responses_returns_defaults(self):
        """Test that empty responses return default values"""
        behavior = self.analyzer.analyze_time_behavior([])

        assert behavior.average_speed == 60.0
        assert behavior.rushing_indicator == 0.0
        assert behavior.hesitation_pattern == []
        assert behavior.optimal_time_range == {"min": 30, "max": 120}

    def test_average_speed_calculation(self):
        """Test average speed calculation"""
        responses = [
            {
                "time_spent": 30,
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": True
            },
            {
                "time_spent": 50,
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": True
            },
            {
                "time_spent": 70,
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": False
            }
        ]

        behavior = self.analyzer.analyze_time_behavior(responses)

        assert behavior.average_speed == 50.0  # (30 + 50 + 70) / 3

    def test_rushing_indicator_calculation(self):
        """Test rushing indicator with rushed answers"""
        responses_rushed = [
            {
                "time_spent": 20,  # 33% of estimated (< 50% threshold)
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": False
            },
            {
                "time_spent": 25,  # 42% of estimated (< 50% threshold)
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": False
            },
            {
                "time_spent": 55,  # Not rushed
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": True
            }
        ]

        behavior = self.analyzer.analyze_time_behavior(responses_rushed)

        # 2 out of 3 rushed, both wrong -> high rushing indicator
        assert behavior.rushing_indicator > 0.5

    def test_no_rushing_indicator(self):
        """Test that non-rushed answers have low rushing indicator"""
        responses_normal = [
            {
                "time_spent": 55,
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": True
            },
            {
                "time_spent": 65,
                "estimated_time": 60,
                "skill_tags": ["skill1"],
                "is_correct": True
            }
        ]

        behavior = self.analyzer.analyze_time_behavior(responses_normal)

        assert behavior.rushing_indicator < 0.2

    def test_hesitation_pattern_identification(self):
        """Test identification of skills with hesitation"""
        responses = [
            {
                "time_spent": 140,  # 233% of estimated (> 200% threshold)
                "estimated_time": 60,
                "skill_tags": ["math.word-problems"],
                "is_correct": False
            },
            {
                "time_spent": 150,  # 250% of estimated
                "estimated_time": 60,
                "skill_tags": ["math.word-problems"],
                "is_correct": True
            },
            {
                "time_spent": 55,  # Normal
                "estimated_time": 60,
                "skill_tags": ["math.arithmetic"],
                "is_correct": True
            },
            {
                "time_spent": 50,  # Normal
                "estimated_time": 60,
                "skill_tags": ["math.arithmetic"],
                "is_correct": True
            }
        ]

        behavior = self.analyzer.analyze_time_behavior(responses)

        assert "math.word-problems" in behavior.hesitation_pattern
        assert "math.arithmetic" not in behavior.hesitation_pattern

    def test_optimal_time_range_calculation(self):
        """Test optimal time range based on correct responses"""
        responses = [
            {"time_spent": 30, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 40, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 50, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 60, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 70, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 80, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 20, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": False},
        ]

        behavior = self.analyzer.analyze_time_behavior(responses)

        # Should use 25th-75th percentile of correct responses
        # Correct times: [30, 40, 50, 60, 70, 80]
        # 25th percentile ~= 42.5, 75th percentile ~= 72.5
        assert 35 <= behavior.optimal_time_range["min"] <= 50
        assert 65 <= behavior.optimal_time_range["max"] <= 85

    def test_optimal_range_bounds(self):
        """Test that optimal range has reasonable bounds"""
        responses = [
            {"time_spent": 5, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 8, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
            {"time_spent": 400, "estimated_time": 60, "skill_tags": ["s1"], "is_correct": True},
        ]

        behavior = self.analyzer.analyze_time_behavior(responses)

        # Should enforce min >= 10, max <= 300
        assert behavior.optimal_time_range["min"] >= 10
        assert behavior.optimal_time_range["max"] <= 300
        assert behavior.optimal_time_range["min"] < behavior.optimal_time_range["max"]

    def test_get_time_recommendations(self):
        """Test recommendation generation"""
        # High rushing
        behavior_rushing = TimeBehavior(
            average_speed=25.0,
            rushing_indicator=0.7,
            hesitation_pattern=[],
            optimal_time_range={"min": 40, "max": 80}
        )

        recs_rushing = self.analyzer.get_time_recommendations(behavior_rushing)
        assert any("slow down" in rec.lower() for rec in recs_rushing)

        # Hesitation on specific skills
        behavior_hesitation = TimeBehavior(
            average_speed=60.0,
            rushing_indicator=0.1,
            hesitation_pattern=["math.fractions", "math.word-problems"],
            optimal_time_range={"min": 50, "max": 80}
        )

        recs_hesitation = self.analyzer.get_time_recommendations(behavior_hesitation)
        assert any("practice" in rec.lower() for rec in recs_hesitation)

    def test_compare_with_peers(self):
        """Test peer comparison"""
        peer_speeds = [40, 50, 60, 70, 80, 90, 100]

        # Fast student (30 seconds)
        fast_comparison = self.analyzer.compare_with_peers(30, peer_speeds)
        assert fast_comparison["status"] == "fast"
        assert fast_comparison["percentile"] > 80

        # Average student (60 seconds)
        avg_comparison = self.analyzer.compare_with_peers(65, peer_speeds)
        assert avg_comparison["status"] == "average"

        # Slow student (110 seconds)
        slow_comparison = self.analyzer.compare_with_peers(110, peer_speeds)
        assert slow_comparison["status"] == "slow"
        assert slow_comparison["percentile"] < 40

    def test_compare_with_no_peers(self):
        """Test peer comparison with no peer data"""
        comparison = self.analyzer.compare_with_peers(60, [])

        assert comparison["percentile"] == 50
        assert comparison["faster_than"] == 50
        assert comparison["status"] == "average"
