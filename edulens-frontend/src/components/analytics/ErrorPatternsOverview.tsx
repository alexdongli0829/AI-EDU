'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Clock, 
  Brain,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { 
  ErrorPattern, 
  ERROR_TYPE_CONFIG, 
  getErrorSeverityColor,
  ErrorType 
} from '@/types/error-analysis';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface ErrorPatternsOverviewProps {
  patterns: ErrorPattern[];
  timeAnalysis: {
    averageTimePerQuestion: number;
    rushingIndicator: number;
    hesitationSkills: string[];
  };
}

export function ErrorPatternsOverview({ patterns, timeAnalysis }: ErrorPatternsOverviewProps) {
  // Prepare data for pie chart
  const pieData = patterns.map(pattern => ({
    name: ERROR_TYPE_CONFIG[pattern.errorType as ErrorType]?.label || pattern.errorType,
    value: pattern.frequency,
    color: ERROR_TYPE_CONFIG[pattern.errorType as ErrorType]?.color || '#6B7280'
  }));

  // Prepare data for severity bar chart
  const severityData = [
    {
      severity: 'High',
      count: patterns.filter(p => p.severity === 'high').length,
      color: '#DC2626'
    },
    {
      severity: 'Medium', 
      count: patterns.filter(p => p.severity === 'medium').length,
      color: '#D97706'
    },
    {
      severity: 'Low',
      count: patterns.filter(p => p.severity === 'low').length,
      color: '#16A34A'
    }
  ];

  const totalErrors = patterns.reduce((sum, pattern) => sum + pattern.frequency, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-teal-600" />
          Error Patterns Overview
        </CardTitle>
        <p className="text-sm text-gray-500">
          Comprehensive analysis of recurring error patterns
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Error Distribution Pie Chart */}
          <div className="lg:col-span-2">
            <h4 className="font-semibold mb-4 text-sm text-gray-700">Error Type Distribution</h4>
            {patterns.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value} errors`, 'Count']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <p>No error patterns detected</p>
                </div>
              </div>
            )}
          </div>

          {/* Pattern Details */}
          <div>
            <h4 className="font-semibold mb-4 text-sm text-gray-700">Pattern Details</h4>
            <div className="space-y-3">
              {patterns.length > 0 ? (
                patterns.slice(0, 5).map((pattern, index) => {
                  const config = ERROR_TYPE_CONFIG[pattern.errorType as ErrorType];
                  return (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config?.icon || '❓'}</span>
                          <span className="text-sm font-medium">
                            {config?.label || pattern.errorType}
                          </span>
                        </div>
                        <Badge className={getErrorSeverityColor(pattern.severity)}>
                          {pattern.severity}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-2">
                        {pattern.frequency} occurrence{pattern.frequency !== 1 ? 's' : ''} • 
                        {pattern.skillsAffected.length} skill{pattern.skillsAffected.length !== 1 ? 's' : ''} affected
                      </div>
                      
                      <div className="text-xs text-gray-600">
                        <strong>Skills:</strong> {pattern.skillsAffected.slice(0, 2).join(', ')}
                        {pattern.skillsAffected.length > 2 && ` +${pattern.skillsAffected.length - 2} more`}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No patterns to display</p>
              )}
            </div>

            {/* Time Analysis Summary */}
            <div className="mt-6">
              <h4 className="font-semibold mb-3 text-sm text-gray-700">Time Analysis</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Average per question:</span>
                  <span className="font-medium">{Math.round(timeAnalysis.averageTimePerQuestion)}s</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Rushing indicator:</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-medium ${
                      timeAnalysis.rushingIndicator > 0.3 ? 'text-red-600' : 
                      timeAnalysis.rushingIndicator > 0.1 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {Math.round(timeAnalysis.rushingIndicator * 100)}%
                    </span>
                    {timeAnalysis.rushingIndicator > 0.3 ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : timeAnalysis.rushingIndicator > 0.1 ? (
                      <Minus className="h-3 w-3 text-yellow-600" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                </div>

                {timeAnalysis.hesitationSkills.length > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-600">Hesitation skills:</span>
                    <div className="mt-1">
                      {timeAnalysis.hesitationSkills.slice(0, 3).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1 mb-1">
                          {skill}
                        </Badge>
                      ))}
                      {timeAnalysis.hesitationSkills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{timeAnalysis.hesitationSkills.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Severity Bar Chart */}
        {patterns.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-4 text-sm text-gray-700">Error Severity Distribution</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="severity" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`${value} patterns`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#8884d8">
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}