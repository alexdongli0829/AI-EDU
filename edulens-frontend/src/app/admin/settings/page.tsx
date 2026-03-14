'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getThresholds,
  updateThresholds,
  DEFAULT_THRESHOLDS,
  ErrorClassificationThresholds,
} from '@/services/system-config';

const THRESHOLD_FIELDS: Array<{
  key: keyof ErrorClassificationThresholds;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    key: 'carelessErrorMaxSeconds',
    label: 'Careless Error Threshold',
    description: 'Questions answered faster than this are classified as Careless Error.',
    unit: 'seconds',
    min: 1, max: 30, step: 1,
  },
  {
    key: 'timePressureMinPctRemaining',
    label: 'Time Pressure Threshold',
    description: 'Questions started when less than this fraction of test time remains are classified as Time Pressure.',
    unit: 'fraction (0–1)',
    min: 0.05, max: 0.5, step: 0.05,
  },
  {
    key: 'conceptGapMinSeconds',
    label: 'Concept Gap Threshold',
    description: 'Questions where the student spent more than this are classified as Concept Gap.',
    unit: 'seconds',
    min: 30, max: 300, step: 10,
  },
];

export default function AdminSettingsPage() {
  const [values, setValues] = useState<ErrorClassificationThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    getThresholds().then(t => { setValues(t); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    const ok = await updateThresholds(values);
    setStatus(ok ? 'saved' : 'error');
    setSaving(false);
    if (ok) setTimeout(() => setStatus('idle'), 3000);
  };

  const handleReset = () => {
    setValues(DEFAULT_THRESHOLDS);
    setStatus('idle');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Admin Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage system-wide configuration thresholds.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Error Classification Thresholds</CardTitle>
            <p className="text-xs text-gray-400 mt-1">
              These thresholds control how wrong answers are automatically classified in test result analysis.
              AI tutor classifications always take priority over these heuristics.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {THRESHOLD_FIELDS.map(({ key, label, description, unit, min, max, step }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-gray-800">{label}</label>
                  <span className="text-xs text-gray-400">{unit}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{description}</p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={values[key]}
                    onChange={e => setValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) || min }))}
                    className="w-32 text-sm"
                  />
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={values[key]}
                    onChange={e => setValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    className="flex-1 accent-teal-600"
                  />
                  <span className="text-sm font-bold text-teal-700 w-12 text-right tabular-nums">
                    {values[key]}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-300 mt-0.5 px-0.5">
                  <span>{min}</span>
                  <span className="text-gray-400">default: {DEFAULT_THRESHOLDS[key]}</span>
                  <span>{max}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {status === 'saved' && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Settings saved successfully.
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> Failed to save. Please try again.
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>Reset to Defaults</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
