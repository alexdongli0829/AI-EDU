/**
 * Timer Service
 * Manages server-authoritative test timer state in Redis.
 */

import { cacheGet, cacheSet, cacheDel } from '@edulens/database';

const TIMER_KEY = (sessionId: string) => `timer:${sessionId}`;

export interface TimerState {
  sessionId: string;
  timeRemaining: number;
  isPaused: boolean;
  lastUpdated: number; // epoch ms
}

export class TimerService {
  async initializeTimer(sessionId: string, totalTime: number): Promise<TimerState> {
    const state: TimerState = {
      sessionId,
      timeRemaining: totalTime,
      isPaused: false,
      lastUpdated: Date.now(),
    };
    await cacheSet(TIMER_KEY(sessionId), state);
    return state;
  }

  async getTimerState(sessionId: string): Promise<TimerState | null> {
    return cacheGet<TimerState>(TIMER_KEY(sessionId));
  }

  async updateTimer(sessionId: string, timeRemaining: number): Promise<TimerState> {
    const state: TimerState = {
      sessionId,
      timeRemaining,
      isPaused: false,
      lastUpdated: Date.now(),
    };
    await cacheSet(TIMER_KEY(sessionId), state);
    return state;
  }

  async decrementTimer(sessionId: string, seconds: number): Promise<TimerState | null> {
    const state = await this.getTimerState(sessionId);
    if (!state || state.isPaused) return state;
    const newTime = Math.max(0, state.timeRemaining - seconds);
    return this.updateTimer(sessionId, newTime);
  }

  async pauseTimer(sessionId: string): Promise<TimerState | null> {
    const state = await this.getTimerState(sessionId);
    if (!state) return null;
    const updated = { ...state, isPaused: true, lastUpdated: Date.now() };
    await cacheSet(TIMER_KEY(sessionId), updated);
    return updated;
  }

  async resumeTimer(sessionId: string): Promise<TimerState | null> {
    const state = await this.getTimerState(sessionId);
    if (!state) return null;
    const updated = { ...state, isPaused: false, lastUpdated: Date.now() };
    await cacheSet(TIMER_KEY(sessionId), updated);
    return updated;
  }

  async stopTimer(sessionId: string): Promise<void> {
    await cacheDel(TIMER_KEY(sessionId));
  }
}
