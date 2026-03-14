// Types for Error Pattern Analysis Dashboard

export interface ErrorPatternAnalytics {
  studentId: string;
  dateRange: {
    from: string;
    to: string;
    days: number;
  };
  totalResponses: number;
  incorrectResponses: number;
  errorPatterns: ErrorPattern[];
  skillErrorMapping: SkillErrorMapping;
  timeAnalysis: {
    averageTimePerQuestion: number;
    rushingIndicator: number;
    hesitationSkills: string[];
  };
  recommendations: string[];
}

export interface ErrorPattern {
  errorType: string;
  frequency: number;
  skillsAffected: string[];
  examples: string[];
  severity: 'low' | 'medium' | 'high';
  firstSeen: string;
  lastSeen: string;
}

export interface SkillErrorMapping {
  [skill: string]: {
    total_errors: number;
    error_types: {
      [errorType: string]: number;
    };
  };
}

export interface ErrorTrendData {
  studentId: string;
  period: 'daily' | 'weekly' | 'monthly';
  dateRange: {
    from: string;
    to: string;
    days: number;
  };
  trends: {
    [errorType: string]: {
      trend: 'improving' | 'stable' | 'worsening';
      change_percent: number;
      first_half_count: number;
      second_half_count: number;
    };
  };
  timeline: TimelineEntry[];
  improvement_indicators: ImprovementIndicator[];
}

export interface TimelineEntry {
  period: string;
  total_errors: number;
  error_breakdown: {
    [errorType: string]: number;
  };
  date: string;
}

export interface ImprovementIndicator {
  type: 'improvement' | 'concern';
  error_type: string;
  message: string;
  change_percent: number;
}

// Error type configurations for UI display
export const ERROR_TYPE_CONFIG = {
  misread_question: {
    label: 'Misread Question',
    color: '#F59E0B',
    icon: '📖',
    description: 'Student misunderstood or misread the question'
  },
  calculation_error: {
    label: 'Calculation Error', 
    color: '#EF4444',
    icon: '🔢',
    description: 'Mathematical calculation mistake'
  },
  careless_mistake: {
    label: 'Careless Mistake',
    color: '#8B5CF6', 
    icon: '⚡',
    description: 'Simple oversight or typo'
  },
  conceptual_gap: {
    label: 'Conceptual Gap',
    color: '#DC2626',
    icon: '🧠',
    description: 'Missing fundamental understanding'
  },
  time_pressure: {
    label: 'Time Pressure',
    color: '#EA580C',
    icon: '⏰',
    description: 'Rushed answer due to time constraint'
  },
  partial_understanding: {
    label: 'Partial Understanding',
    color: '#0891B2',
    icon: '📊',
    description: 'Got partway but incomplete'
  },
  unknown: {
    label: 'Unknown',
    color: '#6B7280',
    icon: '❓',
    description: 'Unable to classify error type'
  }
} as const;

export type ErrorType = keyof typeof ERROR_TYPE_CONFIG;

// Utility functions for error analysis
export const getErrorSeverityColor = (severity: ErrorPattern['severity']) => {
  switch (severity) {
    case 'high': return 'text-red-600 bg-red-50 border-red-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'; 
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getTrendColor = (trend: 'improving' | 'stable' | 'worsening') => {
  switch (trend) {
    case 'improving': return 'text-green-600';
    case 'worsening': return 'text-red-600';
    case 'stable': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

export const getTrendIcon = (trend: 'improving' | 'stable' | 'worsening') => {
  switch (trend) {
    case 'improving': return '↗️';
    case 'worsening': return '↘️'; 
    case 'stable': return '→';
    default: return '→';
  }
};