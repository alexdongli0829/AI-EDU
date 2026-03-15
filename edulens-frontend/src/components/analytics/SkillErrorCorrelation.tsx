'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Network,
  AlertTriangle,
  Target,
  BookOpen
} from 'lucide-react';
import { 
  ErrorPattern,
  SkillErrorMapping,
  ERROR_TYPE_CONFIG,
  ErrorType
} from '@/types/error-analysis';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const NAVY = '#1C3557';
const NAVY_MID = '#254773';
const GOLD = '#B8860B';
const GOLD_BRIGHT = '#D4A017';
const PARCHMENT_MID = '#EDE7D9';

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: NAVY,
    border: `1px solid ${GOLD}`,
    borderRadius: '4px',
    fontSize: 11,
    color: GOLD_BRIGHT,
    fontFamily: "'Source Sans 3', sans-serif",
    padding: '4px 10px',
  },
  itemStyle: { color: GOLD_BRIGHT },
  labelStyle: { color: '#e8edf4', fontWeight: 600 as const },
};

interface SkillErrorCorrelationProps {
  skillErrorMapping: SkillErrorMapping;
  errorPatterns: ErrorPattern[];
}

export function SkillErrorCorrelation({ skillErrorMapping, errorPatterns }: SkillErrorCorrelationProps) {
  // Prepare data for visualization
  const skillData = Object.entries(skillErrorMapping).map(([skill, data]) => {
    // Find most common error type for this skill
    const mostCommonErrorType = Object.entries(data.error_types).reduce(
      (max, [errorType, count]) => count > max.count ? { type: errorType, count } : max,
      { type: '', count: 0 }
    );

    return {
      skill: skill,
      totalErrors: data.total_errors,
      errorTypes: data.error_types,
      mostCommonError: mostCommonErrorType.type,
      mostCommonErrorCount: mostCommonErrorType.count,
      // Calculate error diversity (how many different error types)
      errorDiversity: Object.keys(data.error_types).length
    };
  }).sort((a, b) => b.totalErrors - a.totalErrors);

  // Prepare scatter plot data
  const scatterData = skillData.map((item, index) => ({
    x: item.totalErrors,
    y: item.errorDiversity,
    skill: item.skill,
    mostCommonError: item.mostCommonError,
    color: ERROR_TYPE_CONFIG[item.mostCommonError as ErrorType]?.color || '#6B7280'
  }));

  // Get top skills with most errors
  const topSkillsWithErrors = skillData.slice(0, 8);

  // Calculate correlation insights
  const getSkillRiskLevel = (totalErrors: number, errorDiversity: number) => {
    if (totalErrors >= 5 && errorDiversity >= 3) return 'high';
    if (totalErrors >= 3 && errorDiversity >= 2) return 'medium';
    return 'low';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>
          <Network className="h-5 w-5" style={{ color: GOLD }} />
          Skill-Error Correlation
        </CardTitle>
        <p className="text-sm" style={{ color: NAVY_MID, opacity: 0.65 }}>
          Which skills have the most errors and what types
        </p>
      </CardHeader>
      <CardContent>
        {Object.keys(skillErrorMapping).length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto mb-2" />
              <p>No skill-error correlations found</p>
              <p className="text-sm">Complete more tests to see correlations</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scatter Plot: Total Errors vs Error Diversity */}
            <div>
              <h4 className="font-semibold mb-4 text-sm" style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>
                Error Frequency vs Diversity by Skill
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    data={scatterData}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={PARCHMENT_MID} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Total Errors"
                      tick={{ fontSize: 11, fill: NAVY_MID }}
                      label={{ value: 'Total Errors', position: 'insideBottom', offset: -10, style: { fontSize: '11px', fill: NAVY_MID } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Error Types"
                      tick={{ fontSize: 11, fill: NAVY_MID }}
                      label={{ value: 'Error Types', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fill: NAVY_MID } }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3', stroke: GOLD }}
                      {...TOOLTIP_STYLE}
                      formatter={(value: number, name: string, props: any) => {
                        if (name === 'Total Errors') {
                          return [`${value} errors`, props.payload.skill];
                        }
                        return [`${value} types`, 'Error Diversity'];
                      }}
                      labelFormatter={(value: any, payload: any) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return `${data.skill} • Most common: ${ERROR_TYPE_CONFIG[data.mostCommonError as ErrorType]?.label || data.mostCommonError}`;
                        }
                        return '';
                      }}
                    />
                    <Scatter dataKey="x">
                      {scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Skills Analysis */}
            <div>
              <h4 className="font-semibold mb-4 text-sm" style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>
                Skills Requiring Attention
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topSkillsWithErrors.map((skillItem, index) => {
                  const riskLevel = getSkillRiskLevel(skillItem.totalErrors, skillItem.errorDiversity);
                  const config = ERROR_TYPE_CONFIG[skillItem.mostCommonError as ErrorType];
                  
                  return (
                    <div key={index} className="rounded-lg p-3" style={{ border: `1px solid ${PARCHMENT_MID}`, backgroundColor: '#FDFBF7' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <BookOpen className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {skillItem.skill}
                          </span>
                        </div>
                        <Badge className={getRiskColor(riskLevel)} variant="outline">
                          {riskLevel} risk
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Total errors:</span>
                          <span className="font-medium text-red-600">
                            {skillItem.totalErrors}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Error types:</span>
                          <span className="font-medium">
                            {skillItem.errorDiversity}
                          </span>
                        </div>
                        
                        <div className="text-xs">
                          <span className="text-gray-600">Most common:</span>
                          <div className="flex items-center gap-1 mt-1">
                            <span>{config?.icon || '❓'}</span>
                            <span className="font-medium" style={{ color: config?.color }}>
                              {config?.label || skillItem.mostCommonError}
                            </span>
                            <span className="text-gray-500">
                              ({skillItem.mostCommonErrorCount}x)
                            </span>
                          </div>
                        </div>

                        {/* Error type breakdown */}
                        <div className="text-xs">
                          <span className="text-gray-600">Breakdown:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(skillItem.errorTypes).map(([errorType, count]) => {
                              const errorConfig = ERROR_TYPE_CONFIG[errorType as ErrorType];
                              return (
                                <Badge 
                                  key={errorType} 
                                  variant="secondary" 
                                  className="text-xs px-1 py-0"
                                  style={{ 
                                    backgroundColor: `${errorConfig?.color}20`, 
                                    color: errorConfig?.color,
                                    border: `1px solid ${errorConfig?.color}40`
                                  }}
                                >
                                  {count}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Insights */}
            <div className="rounded-lg p-4" style={{ backgroundColor: '#F5EDD0', borderLeft: `4px solid ${GOLD}` }}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                <div className="text-sm">
                  <h5 className="font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>Key Insights</h5>
                  <ul className="space-y-1" style={{ color: NAVY_MID }}>
                    {skillData.length > 0 && (
                      <li>
                        • <strong>{skillData[0].skill}</strong> needs the most attention with {skillData[0].totalErrors} errors
                      </li>
                    )}
                    {skillData.filter(s => getSkillRiskLevel(s.totalErrors, s.errorDiversity) === 'high').length > 0 && (
                      <li>
                        • {skillData.filter(s => getSkillRiskLevel(s.totalErrors, s.errorDiversity) === 'high').length} skill{skillData.filter(s => getSkillRiskLevel(s.totalErrors, s.errorDiversity) === 'high').length !== 1 ? 's' : ''} marked as high risk
                      </li>
                    )}
                    {skillData.some(s => s.errorDiversity >= 3) && (
                      <li>
                        • Skills with high error diversity may indicate fundamental understanding gaps
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}