'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { 
  ErrorTrendData,
  ERROR_TYPE_CONFIG,
  getTrendColor,
  getTrendIcon,
  ErrorType
} from '@/types/error-analysis';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface ErrorTimelineAnalysisProps {
  trendData: ErrorTrendData | null;
  dateRange: {
    from: string;
    to: string;
    days: number;
  };
}

export function ErrorTimelineAnalysis({ trendData, dateRange }: ErrorTimelineAnalysisProps) {
  if (!trendData || !trendData.timeline.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Error Timeline Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
              <p>No timeline data available</p>
              <p className="text-sm">Complete more tests to see trends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare timeline data for chart
  const chartData = trendData.timeline.map(entry => {
    const result: any = {
      period: entry.period,
      total_errors: entry.total_errors,
      date: new Date(entry.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    };
    
    // Add individual error types as separate data points
    Object.entries(entry.error_breakdown).forEach(([errorType, count]) => {
      result[errorType] = count;
    });
    
    return result;
  });

  // Get all error types present in the data
  const errorTypes = new Set<string>();
  trendData.timeline.forEach(entry => {
    Object.keys(entry.error_breakdown).forEach(type => errorTypes.add(type));
  });

  const errorTypeArray = Array.from(errorTypes);

  // Color mapping for different error types
  const getColorForErrorType = (errorType: string): string => {
    return ERROR_TYPE_CONFIG[errorType as ErrorType]?.color || '#6B7280';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Error Timeline Analysis
        </CardTitle>
        <p className="text-sm text-gray-500">
          Error patterns over time ({dateRange.days} days) • {trendData.period} periods
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Timeline Chart */}
          <div className="lg:col-span-3">
            <h4 className="font-semibold mb-4 text-sm text-gray-700">Error Count Over Time</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {errorTypeArray.map((errorType, index) => (
                      <linearGradient key={errorType} id={`color-${errorType}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getColorForErrorType(errorType)} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={getColorForErrorType(errorType)} stopOpacity={0.1}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      fontSize: '12px', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} errors`, 
                      ERROR_TYPE_CONFIG[name as ErrorType]?.label || name
                    ]}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => ERROR_TYPE_CONFIG[value as ErrorType]?.label || value}
                  />
                  
                  {/* Stack areas for each error type */}
                  {errorTypeArray.map((errorType, index) => (
                    <Area
                      key={errorType}
                      type="monotone"
                      dataKey={errorType}
                      stackId="1"
                      stroke={getColorForErrorType(errorType)}
                      fillOpacity={0.6}
                      fill={`url(#color-${errorType})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Summary */}
          <div>
            <h4 className="font-semibold mb-4 text-sm text-gray-700">Trend Summary</h4>
            <div className="space-y-3">
              {Object.entries(trendData.trends).map(([errorType, trend]) => {
                const config = ERROR_TYPE_CONFIG[errorType as ErrorType];
                const TrendIcon = trend.trend === 'improving' ? TrendingUp :
                                 trend.trend === 'worsening' ? TrendingDown : Minus;
                
                return (
                  <div key={errorType} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{config?.icon || '❓'}</span>
                        <span className="text-xs font-medium">
                          {config?.label || errorType}
                        </span>
                      </div>
                      <TrendIcon className={`h-3 w-3 ${getTrendColor(trend.trend)}`} />
                    </div>
                    
                    <div className={`text-xs font-semibold ${getTrendColor(trend.trend)}`}>
                      {trend.trend === 'improving' && trend.change_percent < 0 ? 
                        `${Math.abs(trend.change_percent)}% better` :
                      trend.trend === 'worsening' && trend.change_percent > 0 ? 
                        `${trend.change_percent}% worse` :
                      'Stable'
                      }
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      {trend.first_half_count} → {trend.second_half_count} errors
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Improvement Indicators */}
            {trendData.improvement_indicators.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3 text-sm text-gray-700">Key Changes</h4>
                <div className="space-y-2">
                  {trendData.improvement_indicators.slice(0, 3).map((indicator, index) => (
                    <div 
                      key={index} 
                      className={`p-2 rounded-md text-xs ${
                        indicator.type === 'improvement' 
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {indicator.type === 'improvement' ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-semibold">
                          {indicator.type === 'improvement' ? 'Improvement' : 'Concern'}
                        </span>
                      </div>
                      <p>{indicator.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Total Error Trend Line */}
        <div className="mt-6">
          <h4 className="font-semibold mb-4 text-sm text-gray-700">Overall Error Trend</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  formatter={(value: number) => [`${value} total errors`, 'Count']}
                />
                <Line 
                  type="monotone" 
                  dataKey="total_errors" 
                  stroke="#2563EB" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563EB' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}