"""
Bayesian Mastery Calculation
Uses Beta-Binomial conjugate prior for skill mastery estimation
"""

import numpy as np
from scipy import stats
from typing import List, Tuple
from ..models.skill_node import SkillNode


class BayesianMasteryCalculator:
    """
    Calculates skill mastery using Bayesian inference with Beta distribution

    Mathematical Model:
    - Prior: Beta(α, β) where α=1, β=1 (uniform prior)
    - Likelihood: Binomial(correct | total_attempts, mastery)
    - Posterior: Beta(α + correct, β + incorrect)
    - Point Estimate: E[mastery] = α / (α + β)
    - Confidence: Based on Beta distribution variance

    Mastery Threshold: 0.7 (70% probability)
    """

    def __init__(
        self,
        prior_alpha: float = 1.0,
        prior_beta: float = 1.0,
        mastery_threshold: float = 0.7,
        min_attempts_for_confidence: int = 5
    ):
        """
        Initialize Bayesian calculator

        Args:
            prior_alpha: Initial alpha parameter (successes + 1)
            prior_beta: Initial beta parameter (failures + 1)
            mastery_threshold: Threshold for considering skill "mastered"
            min_attempts_for_confidence: Minimum attempts needed for high confidence
        """
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.mastery_threshold = mastery_threshold
        self.min_attempts_for_confidence = min_attempts_for_confidence

    def calculate_mastery(
        self,
        correct_attempts: int,
        total_attempts: int
    ) -> Tuple[float, float, float, float]:
        """
        Calculate mastery level and confidence using Bayesian inference

        Args:
            correct_attempts: Number of correct answers
            total_attempts: Total number of attempts

        Returns:
            Tuple of (mastery_level, confidence, alpha, beta)
            - mastery_level: Posterior mean (0-1)
            - confidence: Statistical confidence (0-1)
            - alpha: Posterior alpha parameter
            - beta: Posterior beta parameter
        """
        if total_attempts == 0:
            # No data, return prior
            return 0.5, 0.0, self.prior_alpha, self.prior_beta

        incorrect_attempts = total_attempts - correct_attempts

        # Update Beta distribution parameters (conjugate prior)
        posterior_alpha = self.prior_alpha + correct_attempts
        posterior_beta = self.prior_beta + incorrect_attempts

        # Posterior mean (expected value)
        mastery_level = posterior_alpha / (posterior_alpha + posterior_beta)

        # Calculate confidence
        # Confidence increases with:
        # 1. More attempts (reduces variance)
        # 2. Extreme values (close to 0 or 1)
        confidence = self._calculate_confidence(
            posterior_alpha,
            posterior_beta,
            total_attempts
        )

        return mastery_level, confidence, posterior_alpha, posterior_beta

    def _calculate_confidence(
        self,
        alpha: float,
        beta: float,
        total_attempts: int
    ) -> float:
        """
        Calculate statistical confidence in mastery estimate

        Confidence is based on:
        1. Inverse of variance (lower variance = higher confidence)
        2. Number of attempts (more data = higher confidence)
        3. Credible interval width (narrower = higher confidence)

        Returns:
            Confidence score (0-1)
        """
        # Beta distribution variance: (α*β) / ((α+β)²(α+β+1))
        variance = (alpha * beta) / (
            (alpha + beta) ** 2 * (alpha + beta + 1)
        )

        # Inverse of standard deviation (0-1 scale)
        std_dev = np.sqrt(variance)
        precision = 1 - std_dev

        # Attempt-based confidence (sigmoid function)
        attempt_confidence = self._sigmoid(
            total_attempts - self.min_attempts_for_confidence,
            steepness=0.3
        )

        # Combined confidence (geometric mean)
        confidence = np.sqrt(precision * attempt_confidence)

        return float(np.clip(confidence, 0.0, 1.0))

    def _sigmoid(self, x: float, steepness: float = 1.0) -> float:
        """Sigmoid function for smooth transitions"""
        return 1 / (1 + np.exp(-steepness * x))

    def calculate_credible_interval(
        self,
        alpha: float,
        beta: float,
        confidence_level: float = 0.95
    ) -> Tuple[float, float]:
        """
        Calculate Bayesian credible interval

        Args:
            alpha: Posterior alpha parameter
            beta: Posterior beta parameter
            confidence_level: Credible interval level (default 95%)

        Returns:
            Tuple of (lower_bound, upper_bound)
        """
        lower_percentile = (1 - confidence_level) / 2
        upper_percentile = 1 - lower_percentile

        lower = stats.beta.ppf(lower_percentile, alpha, beta)
        upper = stats.beta.ppf(upper_percentile, alpha, beta)

        return float(lower), float(upper)

    def is_mastered(
        self,
        mastery_level: float,
        confidence: float,
        min_confidence: float = 0.6
    ) -> bool:
        """
        Determine if a skill is considered "mastered"

        Args:
            mastery_level: Posterior mean
            confidence: Statistical confidence
            min_confidence: Minimum confidence required

        Returns:
            True if skill is mastered with sufficient confidence
        """
        return (
            mastery_level >= self.mastery_threshold and
            confidence >= min_confidence
        )

    def update_skill_node(self, skill: SkillNode) -> SkillNode:
        """
        Update a SkillNode with new mastery calculations

        Args:
            skill: SkillNode with attempts data

        Returns:
            Updated SkillNode with new mastery and confidence
        """
        mastery, confidence, alpha, beta = self.calculate_mastery(
            skill.correct_attempts,
            skill.attempts
        )

        skill.mastery_level = mastery
        skill.confidence = confidence
        skill.alpha = alpha
        skill.beta = beta

        return skill

    def calculate_overall_mastery(
        self,
        skill_nodes: List[SkillNode]
    ) -> float:
        """
        Calculate overall mastery across all skills

        Uses weighted average where weights are confidence levels

        Args:
            skill_nodes: List of SkillNode objects

        Returns:
            Overall mastery score (0-1)
        """
        if not skill_nodes:
            return 0.5

        # Filter skills with at least one attempt
        active_skills = [s for s in skill_nodes if s.attempts > 0]

        if not active_skills:
            return 0.5

        # Weighted average by confidence
        total_weight = sum(s.confidence for s in active_skills)

        if total_weight == 0:
            # Fallback to simple average
            return float(np.mean([s.mastery_level for s in active_skills]))

        weighted_mastery = sum(
            s.mastery_level * s.confidence for s in active_skills
        ) / total_weight

        return float(np.clip(weighted_mastery, 0.0, 1.0))

    def identify_strengths_and_weaknesses(
        self,
        skill_nodes: List[SkillNode],
        strength_threshold: float = 0.7,
        weakness_threshold: float = 0.5,
        min_confidence: float = 0.5
    ) -> Tuple[List[str], List[str]]:
        """
        Identify student strengths and weaknesses

        Args:
            skill_nodes: List of SkillNode objects
            strength_threshold: Mastery level for strength (default 0.7)
            weakness_threshold: Mastery level for weakness (default 0.5)
            min_confidence: Minimum confidence to include

        Returns:
            Tuple of (strengths, weaknesses) - lists of skill IDs
        """
        strengths = []
        weaknesses = []

        for skill in skill_nodes:
            # Only consider skills with enough data
            if skill.confidence < min_confidence:
                continue

            if skill.mastery_level >= strength_threshold:
                strengths.append(skill.skill_id)
            elif skill.mastery_level < weakness_threshold:
                weaknesses.append(skill.skill_id)

        # Sort by mastery level
        strengths.sort(
            key=lambda sid: next(
                s.mastery_level for s in skill_nodes if s.skill_id == sid
            ),
            reverse=True
        )

        weaknesses.sort(
            key=lambda sid: next(
                s.mastery_level for s in skill_nodes if s.skill_id == sid
            )
        )

        return strengths, weaknesses


# Example usage
if __name__ == "__main__":
    calculator = BayesianMasteryCalculator()

    # Example: Student answered 7 out of 10 questions correctly
    mastery, confidence, alpha, beta = calculator.calculate_mastery(
        correct_attempts=7,
        total_attempts=10
    )

    print(f"Mastery Level: {mastery:.2f} ({mastery*100:.1f}%)")
    print(f"Confidence: {confidence:.2f} ({confidence*100:.1f}%)")
    print(f"Beta parameters: α={alpha:.1f}, β={beta:.1f}")

    # Credible interval
    lower, upper = calculator.calculate_credible_interval(alpha, beta)
    print(f"95% Credible Interval: [{lower:.2f}, {upper:.2f}]")

    # Is mastered?
    is_mastered = calculator.is_mastered(mastery, confidence)
    print(f"Skill Mastered: {is_mastered}")
