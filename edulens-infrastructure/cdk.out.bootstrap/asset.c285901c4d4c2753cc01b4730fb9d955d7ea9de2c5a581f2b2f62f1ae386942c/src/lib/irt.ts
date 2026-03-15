/**
 * IRT (Item Response Theory) Implementation for Adaptive Testing
 */

export interface IRTItem {
  id: string;
  difficulty: number;    // b parameter (item difficulty)
  discrimination: number; // a parameter (item discrimination)
  guessing?: number;     // c parameter (pseudo-guessing)
}

export interface IRTResponse {
  itemId: string;
  correct: boolean;
  timeSpent?: number;
}

export class IRTEngine {
  private static readonly MAX_ITERATIONS = 20;
  private static readonly CONVERGENCE_THRESHOLD = 0.001;

  /**
   * Calculate probability of correct response using 2PL model
   */
  static calculateProbability(ability: number, item: IRTItem): number {
    const { difficulty, discrimination, guessing = 0 } = item;
    const exponent = discrimination * (ability - difficulty);
    const probability = guessing + (1 - guessing) / (1 + Math.exp(-exponent));
    return Math.max(0.001, Math.min(0.999, probability)); // Bound probability
  }

  /**
   * Estimate ability using Maximum Likelihood Estimation
   */
  static estimateAbility(responses: IRTResponse[], items: IRTItem[], initialAbility = 0): number {
    let ability = initialAbility;
    
    for (let iteration = 0; iteration < this.MAX_ITERATIONS; iteration++) {
      const { logLikelihood, firstDerivative, secondDerivative } = this.calculateLikelihoodDerivatives(
        ability,
        responses,
        items
      );

      if (Math.abs(firstDerivative) < this.CONVERGENCE_THRESHOLD) {
        break;
      }

      // Newton-Raphson update
      const delta = firstDerivative / secondDerivative;
      ability = ability - delta;

      // Bound ability estimate to reasonable range
      ability = Math.max(-4, Math.min(4, ability));
    }

    return ability;
  }

  /**
   * Calculate likelihood and its derivatives for MLE
   */
  private static calculateLikelihoodDerivatives(
    ability: number,
    responses: IRTResponse[],
    items: IRTItem[]
  ) {
    let logLikelihood = 0;
    let firstDerivative = 0;
    let secondDerivative = 0;

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const item = items.find(it => it.id === response.itemId);
      
      if (!item) continue;

      const probability = this.calculateProbability(ability, item);
      const q = 1 - probability;
      const { discrimination: a, guessing: c = 0 } = item;

      // Log-likelihood
      if (response.correct) {
        logLikelihood += Math.log(probability);
      } else {
        logLikelihood += Math.log(q);
      }

      // First derivative (score function)
      const pStar = (probability - c) / (1 - c);
      const qStar = 1 - pStar;
      
      if (response.correct) {
        firstDerivative += a * qStar;
      } else {
        firstDerivative -= a * pStar;
      }

      // Second derivative (information function)
      secondDerivative += a * a * pStar * qStar;
    }

    return { logLikelihood, firstDerivative, secondDerivative: -secondDerivative };
  }

  /**
   * Select next item using Maximum Information Criterion
   */
  static selectNextItem(
    ability: number,
    availableItems: IRTItem[],
    administeredItems: string[]
  ): IRTItem | null {
    const remainingItems = availableItems.filter(item => 
      !administeredItems.includes(item.id)
    );

    if (remainingItems.length === 0) {
      return null;
    }

    // Find item with maximum information at current ability level
    let maxInformation = -Infinity;
    let bestItem = remainingItems[0];

    for (const item of remainingItems) {
      const information = this.calculateItemInformation(ability, item);
      if (information > maxInformation) {
        maxInformation = information;
        bestItem = item;
      }
    }

    return bestItem;
  }

  /**
   * Calculate Fisher Information for an item at given ability level
   */
  static calculateItemInformation(ability: number, item: IRTItem): number {
    const probability = this.calculateProbability(ability, item);
    const q = 1 - probability;
    const { discrimination: a, guessing: c = 0 } = item;

    // Information function for 2PL/3PL model
    const pStar = (probability - c) / (1 - c);
    const qStar = 1 - pStar;

    return a * a * pStar * qStar / (q * q);
  }

  /**
   * Calculate Standard Error of Measurement
   */
  static calculateSEM(ability: number, items: IRTItem[], responses: IRTResponse[]): number {
    let totalInformation = 0;

    for (const response of responses) {
      const item = items.find(it => it.id === response.itemId);
      if (item) {
        totalInformation += this.calculateItemInformation(ability, item);
      }
    }

    return totalInformation > 0 ? 1 / Math.sqrt(totalInformation) : 1;
  }

  /**
   * Check if test should terminate based on precision criteria
   */
  static shouldTerminate(
    ability: number,
    items: IRTItem[],
    responses: IRTResponse[],
    minItems = 5,
    maxItems = 30,
    targetSEM = 0.3
  ): boolean {
    if (responses.length < minItems) {
      return false;
    }

    if (responses.length >= maxItems) {
      return true;
    }

    const sem = this.calculateSEM(ability, items, responses);
    return sem <= targetSEM;
  }

  /**
   * Generate a performance summary
   */
  static generatePerformanceSummary(
    ability: number,
    items: IRTItem[],
    responses: IRTResponse[]
  ) {
    const sem = this.calculateSEM(ability, items, responses);
    const correctCount = responses.filter(r => r.correct).length;
    const totalItems = responses.length;
    const rawScore = correctCount / totalItems;

    // Convert ability to scaled score (e.g., 0-100 scale)
    const scaledScore = Math.round(50 + 10 * ability);
    const confidenceInterval = {
      lower: Math.round(50 + 10 * (ability - 1.96 * sem)),
      upper: Math.round(50 + 10 * (ability + 1.96 * sem))
    };

    return {
      ability,
      scaledScore,
      standardError: sem,
      confidenceInterval,
      rawScore,
      correctCount,
      totalItems,
      reliability: 1 - sem * sem
    };
  }
}