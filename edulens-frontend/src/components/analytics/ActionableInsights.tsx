'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Target,
  BookOpen,
  Clock,
  Brain
} from 'lucide-react';
import { ImprovementIndicator } from '@/types/error-analysis';
import { useRouter } from 'next/navigation';

interface ActionableInsightsProps {
  recommendations: string[];
  improvementIndicators: ImprovementIndicator[];
  studentId: string;
}

export function ActionableInsights({ 
  recommendations, 
  improvementIndicators, 
  studentId 
}: ActionableInsightsProps) {
  const router = useRouter();
  const [expandedRecommendation, setExpandedRecommendation] = useState<number | null>(null);

  // Categorize recommendations by type
  const categorizeRecommendation = (rec: string) => {
    if (rec.toLowerCase().includes('time') || rec.toLowerCase().includes('speed')) {
      return { type: 'time', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    }
    if (rec.toLowerCase().includes('concept') || rec.toLowerCase().includes('fundamental')) {
      return { type: 'concept', icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' };
    }
    if (rec.toLowerCase().includes('practice') || rec.toLowerCase().includes('skill')) {
      return { type: 'practice', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    }
    if (rec.toLowerCase().includes('read') || rec.toLowerCase().includes('question')) {
      return { type: 'comprehension', icon: BookOpen, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    }
    return { type: 'general', icon: Lightbulb, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
  };

  // Separate improvements and concerns
  const improvements = improvementIndicators.filter(i => i.type === 'improvement');
  const concerns = improvementIndicators.filter(i => i.type === 'concern');

  // Generate specific action items based on recommendations
  const generateActionItems = (recommendation: string) => {
    if (recommendation.toLowerCase().includes('time management')) {
      return [
        'Set a timer for each practice session',
        'Practice quick estimation techniques',
        'Focus on accuracy first, then build speed',
        'Review time limits before starting tests'
      ];
    }
    if (recommendation.toLowerCase().includes('calculation')) {
      return [
        'Practice basic arithmetic daily',
        'Use estimation to check answers',
        'Show work step-by-step',
        'Double-check calculations before submitting'
      ];
    }
    if (recommendation.toLowerCase().includes('concept') || recommendation.toLowerCase().includes('fundamental')) {
      return [
        'Review prerequisite topics',
        'Use visual aids and examples',
        'Practice with simpler problems first',
        'Seek help from teacher or tutor'
      ];
    }
    if (recommendation.toLowerCase().includes('read')) {
      return [
        'Read questions twice before answering',
        'Underline key words and phrases',
        'Look for question-specific instructions',
        'Practice active reading strategies'
      ];
    }
    return [
      'Practice regularly in this area',
      'Break down complex problems into steps',
      'Ask for help when needed',
      'Review mistakes to understand patterns'
    ];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          Actionable Insights
        </CardTitle>
        <p className="text-sm text-gray-500">
          Personalized recommendations and improvement tracking
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicators */}
        {(improvements.length > 0 || concerns.length > 0) && (
          <div>
            <h4 className="font-semibold mb-3 text-sm text-gray-700">Progress Indicators</h4>
            <div className="space-y-2">
              {improvements.slice(0, 3).map((improvement, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-green-800">Improvement</span>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                        {Math.abs(improvement.change_percent)}% better
                      </Badge>
                    </div>
                    <p className="text-sm text-green-700">{improvement.message}</p>
                  </div>
                </div>
              ))}

              {concerns.slice(0, 2).map((concern, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-red-800">Needs Attention</span>
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        {concern.change_percent}% increase
                      </Badge>
                    </div>
                    <p className="text-sm text-red-700">{concern.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div>
          <h4 className="font-semibold mb-3 text-sm text-gray-700">Recommendations</h4>
          {recommendations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No specific recommendations yet</p>
              <p className="text-xs">Complete more tests to get personalized advice</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => {
                const category = categorizeRecommendation(rec);
                const Icon = category.icon;
                const isExpanded = expandedRecommendation === index;
                const actionItems = generateActionItems(rec);

                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-4 ${category.bg} ${category.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 ${category.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {rec}
                        </p>
                        
                        {isExpanded && (
                          <div className="mt-3">
                            <h6 className="text-xs font-semibold text-gray-700 mb-2">
                              Specific Action Steps:
                            </h6>
                            <ul className="space-y-1">
                              {actionItems.map((action, actionIndex) => (
                                <li 
                                  key={actionIndex}
                                  className="text-xs text-gray-600 flex items-start gap-2"
                                >
                                  <span className={`w-1 h-1 rounded-full ${category.color.replace('text-', 'bg-')} mt-2 flex-shrink-0`}></span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRecommendation(
                            isExpanded ? null : index
                          )}
                          className="mt-2 h-6 text-xs"
                        >
                          {isExpanded ? 'Show less' : 'Show action steps'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3 text-sm text-gray-700">Quick Actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={() => router.push(`/parent/chat?studentId=${studentId}`)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              size="sm"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Discuss with AI Tutor
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => router.push(`/parent/analytics/${studentId}`)}
              size="sm"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              View Full Analytics
            </Button>
          </div>
        </div>

        {/* Next Steps Summary */}
        {(improvements.length > 0 || concerns.length > 0 || recommendations.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <h5 className="font-semibold text-blue-900 mb-2">Next Steps Summary</h5>
                <div className="space-y-1 text-blue-800">
                  {improvements.length > 0 && (
                    <p>✅ Great progress on {improvements.length} error type{improvements.length !== 1 ? 's' : ''}</p>
                  )}
                  {concerns.length > 0 && (
                    <p>⚠️ Focus needed on {concerns.length} emerging concern{concerns.length !== 1 ? 's' : ''}</p>
                  )}
                  {recommendations.length > 0 && (
                    <p>💡 {recommendations.length} specific recommendation{recommendations.length !== 1 ? 's' : ''} to follow</p>
                  )}
                  <p className="text-xs text-blue-600 mt-2">
                    Discuss these insights with the AI tutor for personalized learning plans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}