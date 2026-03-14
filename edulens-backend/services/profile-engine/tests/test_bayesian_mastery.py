"""
Unit tests for Bayesian Mastery Calculator
"""

import pytest
from src.algorithms.bayesian_mastery import BayesianMasteryCalculator
from src.models.skill_node import SkillNode


class TestBayesianMasteryCalculator:
    """Test suite for Bayesian mastery calculation"""

    def setup_method(self):
        """Set up test fixtures"""
        self.calculator = BayesianMasteryCalculator(
            prior_alpha=1.0,
            prior_beta=1.0,
            mastery_threshold=0.7,
            min_attempts_for_confidence=5
        )

    def test_no_attempts_returns_prior(self):
        """Test that zero attempts returns prior distribution"""
        mastery, confidence, alpha, beta = self.calculator.calculate_mastery(
            correct_attempts=0,
            total_attempts=0
        )

        assert mastery == 0.5  # Uniform prior mean
        assert confidence == 0.0  # No confidence with no data
        assert alpha == 1.0  # Prior alpha
        assert beta == 1.0  # Prior beta

    def test_perfect_score_high_mastery(self):
        """Test that perfect score gives high mastery"""
        mastery, confidence, alpha, beta = self.calculator.calculate_mastery(
            correct_attempts=10,
            total_attempts=10
        )

        assert mastery > 0.9  # Very high mastery
        assert confidence > 0.7  # Good confidence with 10 attempts
        assert alpha == 11.0  # 1 + 10
        assert beta == 1.0  # 1 + 0

    def test_zero_score_low_mastery(self):
        """Test that zero score gives low mastery"""
        mastery, confidence, alpha, beta = self.calculator.calculate_mastery(
            correct_attempts=0,
            total_attempts=10
        )

        assert mastery < 0.1  # Very low mastery
        assert confidence > 0.7  # Good confidence with 10 attempts
        assert alpha == 1.0  # 1 + 0
        assert beta == 11.0  # 1 + 10

    def test_partial_score_moderate_mastery(self):
        """Test that 50% score gives moderate mastery"""
        mastery, confidence, alpha, beta = self.calculator.calculate_mastery(
            correct_attempts=5,
            total_attempts=10
        )

        assert 0.4 < mastery < 0.6  # Around 50%
        assert confidence > 0.6  # Decent confidence
        assert alpha == 6.0  # 1 + 5
        assert beta == 6.0  # 1 + 5

    def test_confidence_increases_with_attempts(self):
        """Test that confidence increases as more attempts are made"""
        _, conf_low, _, _ = self.calculator.calculate_mastery(
            correct_attempts=3,
            total_attempts=5
        )

        _, conf_high, _, _ = self.calculator.calculate_mastery(
            correct_attempts=6,
            total_attempts=10
        )

        assert conf_high > conf_low

    def test_credible_interval(self):
        """Test credible interval calculation"""
        _, _, alpha, beta = self.calculator.calculate_mastery(
            correct_attempts=7,
            total_attempts=10
        )

        lower, upper = self.calculator.calculate_credible_interval(
            alpha, beta, confidence_level=0.95
        )

        assert 0.0 <= lower < upper <= 1.0
        # With only 10 attempts, interval can be wider
        assert upper - lower < 0.7  # Reasonably wide for small sample

    def test_is_mastered_threshold(self):
        """Test mastery threshold logic"""
        # High mastery, high confidence
        assert self.calculator.is_mastered(
            mastery_level=0.75,
            confidence=0.7,
            min_confidence=0.6
        ) is True

        # High mastery, low confidence
        assert self.calculator.is_mastered(
            mastery_level=0.75,
            confidence=0.5,
            min_confidence=0.6
        ) is False

        # Low mastery, high confidence
        assert self.calculator.is_mastered(
            mastery_level=0.65,
            confidence=0.7,
            min_confidence=0.6
        ) is False

    def test_update_skill_node(self):
        """Test updating a skill node"""
        skill = SkillNode(
            skill_id="math.addition",
            skill_name="Addition",
            subject="math",
            attempts=10,
            correct_attempts=8
        )

        updated_skill = self.calculator.update_skill_node(skill)

        assert updated_skill.mastery_level > 0.7
        assert updated_skill.confidence > 0.6
        assert updated_skill.alpha == 9.0  # 1 + 8
        assert updated_skill.beta == 3.0  # 1 + 2

    def test_calculate_overall_mastery(self):
        """Test overall mastery calculation across skills"""
        skills = [
            SkillNode(
                skill_id="skill1",
                skill_name="Skill 1",
                subject="math",
                mastery_level=0.8,
                confidence=0.9,
                attempts=10,
                correct_attempts=8
            ),
            SkillNode(
                skill_id="skill2",
                skill_name="Skill 2",
                subject="math",
                mastery_level=0.6,
                confidence=0.7,
                attempts=10,
                correct_attempts=6
            )
        ]

        overall = self.calculator.calculate_overall_mastery(skills)

        # Should be weighted average, closer to skill1 (higher confidence)
        assert 0.6 < overall < 0.8

    def test_identify_strengths_and_weaknesses(self):
        """Test strength/weakness identification"""
        skills = [
            SkillNode(
                skill_id="strong_skill",
                skill_name="Strong Skill",
                subject="math",
                mastery_level=0.85,
                confidence=0.8,
                attempts=10,
                correct_attempts=9
            ),
            SkillNode(
                skill_id="weak_skill",
                skill_name="Weak Skill",
                subject="math",
                mastery_level=0.35,
                confidence=0.7,
                attempts=10,
                correct_attempts=3
            ),
            SkillNode(
                skill_id="average_skill",
                skill_name="Average Skill",
                subject="math",
                mastery_level=0.60,
                confidence=0.6,
                attempts=10,
                correct_attempts=6
            )
        ]

        strengths, weaknesses = self.calculator.identify_strengths_and_weaknesses(
            skills,
            strength_threshold=0.7,
            weakness_threshold=0.5,
            min_confidence=0.5
        )

        assert "strong_skill" in strengths
        assert "weak_skill" in weaknesses
        assert "average_skill" not in strengths
        assert "average_skill" not in weaknesses
