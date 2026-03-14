import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev';
const SSE_URL = process.env.NEXT_PUBLIC_SSE_URL || API_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://rdtva58ibf.execute-api.us-east-1.amazonaws.com/dev';

export class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          this.token = null;
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  async register(data: { email: string; password: string; name: string; role: string }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async logout() {
    this.clearToken();
  }

  // Test Engine
  async getTests() {
    const response = await this.client.get('/tests');
    return response.data;
  }

  async getTest(testId: string) {
    const response = await this.client.get(`/tests/${testId}`);
    return response.data;
  }

  async startTestSession(testId: string, studentId: string) {
    const response = await this.client.post('/sessions', { testId, studentId });
    return response.data;
  }

  async submitAnswer(sessionId: string, questionId: string, answer: string, timeSpent: number) {
    const response = await this.client.post(`/sessions/${sessionId}/answers`, {
      questionId,
      answer,
      timeSpent,
    });
    return response.data;
  }

  async endTestSession(sessionId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/end`);
    return response.data;
  }

  // Parent Chat
  async createParentChatSession(parentId: string, studentId: string) {
    const response = await this.client.post('/parent-chat', { parentId, studentId });
    return response.data;
  }

  async getParentChatMessages(sessionId: string, limit = 50, offset = 0) {
    const response = await this.client.get(`/parent-chat/${sessionId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async endParentChatSession(sessionId: string) {
    const response = await this.client.post(`/parent-chat/${sessionId}/end`);
    return response.data;
  }

  // Student Chat
  async createStudentChatSession(studentId: string) {
    const response = await this.client.post('/student-chat', { studentId });
    return response.data;
  }

  async getStudentChatMessages(sessionId: string, limit = 50, offset = 0) {
    const response = await this.client.get(`/student-chat/${sessionId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async endStudentChatSession(sessionId: string) {
    const response = await this.client.post(`/student-chat/${sessionId}/end`);
    return response.data;
  }

  // SSE Streaming (for chat)
  createSSEConnection(url: string, onMessage: (data: any) => void, onError?: (error: any) => void) {
    const eventSource = new EventSource(url);

    eventSource.addEventListener('delta', (event) => {
      const data = JSON.parse(event.data);
      onMessage({ type: 'delta', data });
    });

    eventSource.addEventListener('done', (event) => {
      const data = JSON.parse(event.data);
      onMessage({ type: 'done', data });
      eventSource.close();
    });

    eventSource.onerror = (error) => {
      if (onError) onError(error);
      eventSource.close();
    };

    return eventSource;
  }

  // WebSocket (for timer sync)
  createWebSocketConnection(studentId: string, sessionId: string) {
    const ws = new WebSocket(`${WS_URL}?studentId=${studentId}&sessionId=${sessionId}`);
    return ws;
  }

  // Student Management (Parent operations)
  async createStudent(data: {
    parentId: string;
    name: string;
    username: string;
    password: string;
    gradeLevel: number;
    dateOfBirth: string;
  }) {
    const response = await this.client.post('/auth/create-student', data);
    return response.data;
  }

  async listStudents(parentId: string) {
    const response = await this.client.get(`/auth/students?parentId=${parentId}`);
    return response.data;
  }

  async deleteStudent(studentId: string, parentId: string) {
    const response = await this.client.post('/auth/delete-student', { studentId, parentId });
    return response.data;
  }

  // Student Login (username-based)
  async studentLogin(username: string, password: string) {
    const response = await this.client.post('/auth/student-login', { username, password });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  // Student Profile
  async getStudentProfile(studentId: string) {
    const response = await this.client.get(`/students/${studentId}/profile`);
    return response.data;
  }

  // Student Insights (AI-generated per-subject analysis)
  async getStudentInsights(studentId: string) {
    const response = await this.client.get(`/students/${studentId}/insights`, { timeout: 90000 });
    return response.data;
  }

  async regenerateStudentInsights(studentId: string) {
    const response = await this.client.post(`/students/${studentId}/insights`, {}, { timeout: 90000 });
    return response.data;
  }

  async getSkillDetail(studentId: string, skillId: string) {
    const response = await this.client.get(`/students/${studentId}/skills/${skillId}`);
    return response.data;
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient();
  }
  return apiClientInstance;
}

export const apiClient = getApiClient();
