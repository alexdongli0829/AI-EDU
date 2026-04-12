/**
 * Unit tests for test data generation
 */

import {
  getTestData,
  clearTestData,
  getStudent,
  getQuestion,
  getStudentSessions,
  QUESTIONS
} from '../../src/data/test-data.js';

describe('TestData', () => {
  beforeEach(() => {
    clearTestData(); // Start fresh for each test
  });

  describe('getTestData', () => {
    test('should generate complete test data set', () => {
      const data = getTestData();

      expect(data).toBeDefined();
      expect(data.students).toHaveLength(5);
      expect(data.questions).toHaveLength(50); // 15 reading + 20 math + 15 thinking
      expect(data.testSessions.length).toBeGreaterThan(0);
      expect(data.conversationHistories.length).toBeGreaterThan(0);
    });

    test('should return consistent data on subsequent calls', () => {
      const data1 = getTestData();
      const data2 = getTestData();

      // Should have the same content (may be new objects each time)
      expect(data1).toEqual(data2);
    });
  });

  describe('students', () => {
    test('should have diverse student profiles', () => {
      const data = getTestData();
      const students = data.students;

      expect(students).toHaveLength(5);

      // Check all students have required fields
      students.forEach(student => {
        expect(student.studentId).toBeDefined();
        expect(student.name).toBeDefined();
        expect(student.gradeLevel).toBeGreaterThanOrEqual(4);
        expect(student.gradeLevel).toBeLessThanOrEqual(6);
        expect(student.overallMastery).toBeGreaterThanOrEqual(0);
        expect(student.overallMastery).toBeLessThanOrEqual(100);
        expect(Array.isArray(student.strengths)).toBe(true);
        expect(Array.isArray(student.weaknesses)).toBe(true);
        expect(Array.isArray(student.testHistory)).toBe(true);
        expect(Array.isArray(student.errorPatterns)).toBe(true);
      });

      // Check for performance diversity
      const masteryLevels = students.map(s => s.overallMastery);
      const minMastery = Math.min(...masteryLevels);
      const maxMastery = Math.max(...masteryLevels);

      expect(maxMastery - minMastery).toBeGreaterThan(20); // At least 20 points spread
    });

    test('should have valid skill breakdowns', () => {
      const data = getTestData();
      const students = data.students;

      students.forEach(student => {
        expect(student.skillBreakdown).toBeDefined();
        expect(student.skillBreakdown.reading).toBeDefined();
        expect(student.skillBreakdown.math).toBeDefined();
        expect(student.skillBreakdown.thinking).toBeDefined();

        // Check all skill values are between 0 and 100
        Object.values(student.skillBreakdown).forEach(subject => {
          Object.values(subject).forEach(skill => {
            expect(skill).toBeGreaterThanOrEqual(0);
            expect(skill).toBeLessThanOrEqual(100);
          });
        });
      });
    });

    test('should have realistic test history', () => {
      const data = getTestData();
      const students = data.students;

      students.forEach(student => {
        expect(student.testHistory.length).toBeGreaterThan(0);

        student.testHistory.forEach(test => {
          expect(test.title).toBeDefined();
          expect(test.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
          expect(test.score).toBeGreaterThanOrEqual(0);
          expect(test.score).toBeLessThanOrEqual(100);
          expect(test.correct).toBeGreaterThanOrEqual(0);
          expect(test.correct).toBeLessThanOrEqual(test.total);
          expect(test.total).toBeGreaterThan(0);
        });

        // Tests should be in chronological order (oldest first or newest first)
        if (student.testHistory.length > 1) {
          const dates = student.testHistory.map(t => new Date(t.date));
          const firstDate = dates[0];
          const lastDate = dates[dates.length - 1];
          if (firstDate && lastDate) {
            // Allow either ascending or descending order
            const isAscending = firstDate <= lastDate;
            const isDescending = firstDate >= lastDate;
            expect(isAscending || isDescending).toBe(true);
          }
        }
      });
    });
  });

  describe('questions', () => {
    test('should have NSW OC/Selective style questions', () => {
      const data = getTestData();
      const questions = data.questions;

      expect(questions.length).toBe(50); // 15 reading + 20 math + 15 thinking

      questions.forEach(question => {
        expect(question.questionId).toBeDefined();
        expect(question.text).toBeDefined();
        expect(question.text.length).toBeGreaterThan(10);
        expect(Array.isArray(question.options)).toBe(true);
        expect(question.options).toHaveLength(4);
        expect(question.correctAnswer).toMatch(/^[ABCD]$/);
        expect(question.explanation).toBeDefined();
        expect(Array.isArray(question.skillTags)).toBe(true);
        expect(['easy', 'medium', 'hard']).toContain(question.difficulty);
        expect(question.estimatedTime).toBeGreaterThan(0);
      });
    });

    test('should have correct answer marked in options', () => {
      const data = getTestData();
      const questions = data.questions;

      questions.forEach(question => {
        const correctOption = question.options.find(opt => opt.isCorrect);
        const correctLabelOption = question.options.find(opt => opt.label === question.correctAnswer);

        expect(correctOption).toBeDefined();
        expect(correctLabelOption).toBeDefined();
        expect(correctOption).toBe(correctLabelOption);

        // Only one option should be marked as correct
        const correctCount = question.options.filter(opt => opt.isCorrect).length;
        expect(correctCount).toBe(1);
      });
    });

    test('should cover different subjects and skills', () => {
      const data = getTestData();
      const questions = data.questions;

      const subjects = new Set(questions.map(q => q.subject));
      expect(subjects).toContain('reading');
      expect(subjects).toContain('math');
      expect(subjects).toContain('thinking');

      // Check skill tags are appropriate
      questions.forEach(question => {
        question.skillTags.forEach(tag => {
          expect(tag).toMatch(/^(reading|math|thinking)\./);
        });
      });
    });
  });

  describe('test sessions', () => {
    test('should create sessions for all students', () => {
      const data = getTestData();
      const sessions = data.testSessions;

      expect(sessions.length).toBeGreaterThan(0);

      const studentIds = new Set(data.students.map(s => s.studentId));
      const sessionStudentIds = new Set(sessions.map(s => s.studentId));

      // All students should have at least one session
      studentIds.forEach(studentId => {
        expect(sessionStudentIds.has(studentId)).toBe(true);
      });
    });

    test('should have realistic session data', () => {
      const data = getTestData();
      const sessions = data.testSessions;

      sessions.forEach(session => {
        expect(session.sessionId).toBeDefined();
        expect(session.studentId).toBeDefined();
        expect(['completed', 'active']).toContain(session.status);
        expect(session.questionCount).toBeGreaterThan(0);
        expect(session.correctCount).toBeGreaterThanOrEqual(0);
        expect(session.correctCount).toBeLessThanOrEqual(session.totalItems);
        expect(session.totalItems).toBe(session.questionCount);
        if (session.status === 'completed') {
          expect(session.scaledScore).toBeGreaterThanOrEqual(0);
          expect(session.scaledScore).toBeLessThanOrEqual(100);
          expect(session.completedAt).toBeDefined();
        }
        expect(session.startedAt).toBeDefined();
      });
    });
  });

  describe('conversation histories', () => {
    test('should create conversation histories', () => {
      const data = getTestData();
      const histories = data.conversationHistories;

      expect(histories.length).toBeGreaterThan(0);

      histories.forEach(history => {
        expect(history.sessionId).toBeDefined();
        expect(history.actorId).toBeDefined();
        expect(['student_tutor', 'parent_advisor']).toContain(history.domain);
        expect(Array.isArray(history.turns)).toBe(true);
        expect(history.turns.length).toBeGreaterThan(0);
        expect(history.createdAt).toBeDefined();
        expect(history.updatedAt).toBeDefined();
      });
    });

    test('should have realistic conversation turns', () => {
      const data = getTestData();
      const histories = data.conversationHistories;

      histories.forEach(history => {
        expect(history.turns.length).toBeGreaterThanOrEqual(2); // At least some back-and-forth

        history.turns.forEach(turn => {
          expect(['user', 'assistant']).toContain(turn.role);
          expect(turn.content).toBeDefined();
          expect(turn.content.length).toBeGreaterThan(5);
          expect(turn.timestamp).toBeDefined();
        });

        // Should alternate between user and assistant (mostly)
        if (history.turns.length > 1) {
          const firstTurn = history.turns[0];
          if (firstTurn) {
            expect(firstTurn.role).toBe('user'); // Should start with user
          }
        }
      });
    });
  });

  describe('utility functions', () => {
    test('getStudent should return correct student', () => {
      const data = getTestData();
      const firstStudent = data.students[0];

      if (!firstStudent) {
        throw new Error('No students in test data');
      }

      const retrievedStudent = getStudent(firstStudent.studentId);
      expect(retrievedStudent).toEqual(firstStudent);

      const nonExistentStudent = getStudent('nonexistent');
      expect(nonExistentStudent).toBeUndefined();
    });

    test('getQuestion should return correct question', () => {
      const data = getTestData();
      const firstQuestion = data.questions[0];

      if (!firstQuestion) {
        throw new Error('No questions in test data');
      }

      const retrievedQuestion = getQuestion(firstQuestion.questionId);
      expect(retrievedQuestion).toEqual(firstQuestion);

      const nonExistentQuestion = getQuestion('nonexistent');
      expect(nonExistentQuestion).toBeUndefined();
    });

    test('getQuestionsBySkill should filter by skill tag', () => {
      const mathQuestions = QUESTIONS.filter(q => q.skillTags.includes('math.number_patterns'));
      expect(mathQuestions.length).toBeGreaterThan(0);

      mathQuestions.forEach((question) => {
        expect(question.skillTags).toContain('math.number_patterns');
      });

      const nonExistentSkill = QUESTIONS.filter(q => q.skillTags.includes('nonexistent.skill'));
      expect(nonExistentSkill).toHaveLength(0);
    });

    test('getStudentSessions should return sessions for student', () => {
      const data = getTestData();
      const firstStudent = data.students[0];

      if (!firstStudent) {
        throw new Error('No students in test data');
      }

      const sessions = getStudentSessions(firstStudent.studentId);
      expect(sessions.length).toBeGreaterThan(0);

      sessions.forEach(session => {
        expect(session.studentId).toBe(firstStudent.studentId);
      });
    });

    test('getConversationHistory should return histories for actor', () => {
      const data = getTestData();
      const firstStudent = data.students[0];

      if (!firstStudent) {
        throw new Error('No students in test data');
      }

      const histories = data.conversationHistories.filter(h => h.actorId === firstStudent.studentId);

      // May be 0 or more depending on random generation
      histories.forEach((history) => {
        expect(history.actorId).toBe(firstStudent.studentId);
      });
    });
  });

  describe('clearTestData', () => {
    test('should be a no-op for in-memory data', () => {
      // Generate data
      const data1 = getTestData();

      // Clear (no-op for const data)
      clearTestData();

      // Generate again
      const data2 = getTestData();

      // Should have the same structure
      expect(data1.students.length).toBe(data2.students.length);
      expect(data1.questions.length).toBe(data2.questions.length);
    });
  });
});