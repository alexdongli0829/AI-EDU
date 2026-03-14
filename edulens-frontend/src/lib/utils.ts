import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function getScoreColor(score: number): string {
  if (score >= 0.9) return 'text-green-600';
  if (score >= 0.7) return 'text-blue-600';
  if (score >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

export function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.9) return 'Mastered';
  if (mastery >= 0.7) return 'Proficient';
  if (mastery >= 0.5) return 'Developing';
  return 'Needs Practice';
}

export function getMasteryColor(mastery: number): string {
  if (mastery >= 0.9) return 'bg-green-500';
  if (mastery >= 0.7) return 'bg-blue-500';
  if (mastery >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}
