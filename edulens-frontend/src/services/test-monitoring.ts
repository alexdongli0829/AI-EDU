// Enhanced test monitoring interface
export interface TestInteraction {
  timestamp: number;
  type: 'hover' | 'click' | 'selection' | 'hesitation' | 'change' | 'question_start';
  questionId: string;
  optionId?: string;
  timeSpent: number;
  data?: any;
}

export interface EnhancedTestSession {
  sessionId: string;
  studentId: string;
  testId: string;
  currentQuestionIndex: number;
  timeRemaining: number;
  interactions: TestInteraction[];
  questionStartTime: number;
  choiceAttempts: { [questionId: string]: string[] };
  hesitationPatterns: { [questionId: string]: number[] };
  confidenceLevels: { [questionId: string]: number };
}

class TestMonitoringService {
  private interactions: TestInteraction[] = [];
  private questionStartTime: number = 0;
  private currentQuestionId: string = '';
  private choiceAttempts: { [questionId: string]: string[] } = {};
  private hesitationTimer: NodeJS.Timeout | null = null;
  private lastInteractionTime: number = 0;

  startQuestion(questionId: string) {
    this.currentQuestionId = questionId;
    this.questionStartTime = Date.now();
    this.lastInteractionTime = Date.now();
    
    if (!this.choiceAttempts[questionId]) {
      this.choiceAttempts[questionId] = [];
    }

    this.recordInteraction('question_start', questionId);
  }

  recordHover(optionId: string) {
    this.recordInteraction('hover', this.currentQuestionId, optionId);
  }

  recordClick(optionId: string) {
    this.recordInteraction('click', this.currentQuestionId, optionId);
  }

  recordSelection(optionId: string) {
    // Track choice attempts
    if (!this.choiceAttempts[this.currentQuestionId].includes(optionId)) {
      this.choiceAttempts[this.currentQuestionId].push(optionId);
    }
    
    this.recordInteraction('selection', this.currentQuestionId, optionId);
    this.resetHesitationTimer();
  }

  recordAnswerChange(fromOption: string, toOption: string) {
    this.recordInteraction('change', this.currentQuestionId, toOption, {
      from: fromOption,
      to: toOption,
      changeCount: this.getChangeCount()
    });
  }

  private recordInteraction(type: TestInteraction['type'], questionId: string, optionId?: string, data?: any) {
    const now = Date.now();
    
    this.interactions.push({
      timestamp: now,
      type,
      questionId,
      optionId,
      timeSpent: now - this.questionStartTime,
      data
    });

    this.lastInteractionTime = now;
    this.startHesitationTimer();
  }

  private startHesitationTimer() {
    if (this.hesitationTimer) {
      clearTimeout(this.hesitationTimer);
    }

    // Record hesitation if no interaction for 3+ seconds
    this.hesitationTimer = setTimeout(() => {
      this.recordInteraction('hesitation', this.currentQuestionId);
    }, 3000);
  }

  private resetHesitationTimer() {
    if (this.hesitationTimer) {
      clearTimeout(this.hesitationTimer);
      this.hesitationTimer = null;
    }
  }

  private getChangeCount(): number {
    return this.interactions.filter(
      i => i.type === 'change' && i.questionId === this.currentQuestionId
    ).length;
  }

  getQuestionAnalytics(questionId: string) {
    const questionInteractions = this.interactions.filter(i => i.questionId === questionId);
    const totalTime = this.getQuestionTime(questionId);
    const attempts = this.choiceAttempts[questionId] || [];
    const changes = questionInteractions.filter(i => i.type === 'change').length;
    const hesitations = questionInteractions.filter(i => i.type === 'hesitation').length;

    return {
      totalTime,
      attempts: attempts.length,
      changes,
      hesitations,
      interactionPattern: questionInteractions.map(i => ({
        type: i.type,
        timeOffset: i.timeSpent,
        optionId: i.optionId
      }))
    };
  }

  private getQuestionTime(questionId: string): number {
    const questionInteractions = this.interactions.filter(i => i.questionId === questionId);
    if (questionInteractions.length === 0) return 0;
    
    const start = questionInteractions[0].timestamp;
    const end = questionInteractions[questionInteractions.length - 1].timestamp;
    return end - start;
  }

  getAllInteractions(): TestInteraction[] {
    return [...this.interactions];
  }

  getChoiceAttempts(): { [questionId: string]: string[] } {
    return { ...this.choiceAttempts };
  }

  reset() {
    this.interactions = [];
    this.choiceAttempts = {};
    this.questionStartTime = 0;
    this.currentQuestionId = '';
    
    if (this.hesitationTimer) {
      clearTimeout(this.hesitationTimer);
      this.hesitationTimer = null;
    }
  }
}

export const testMonitoringService = new TestMonitoringService();