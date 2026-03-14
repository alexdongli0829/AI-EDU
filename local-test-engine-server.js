#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

// Mock database for local testing
const tests = {};
const sessions = {};
const answers = {};

// Sample test data
const sampleMathTest = {
  id: 'sample-math-8',
  title: 'Grade 8 Math Assessment',
  description: 'Adaptive math test covering algebra, geometry, and statistics',
  subject: 'Mathematics',
  gradeLevel: 8,
  timeLimit: 60, // minutes
  questionCount: 15,
  createdAt: new Date().toISOString(),
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice',
      text: 'Solve for x: 2x + 5 = 13',
      options: ['x = 3', 'x = 4', 'x = 6', 'x = 9'],
      correctAnswer: 'x = 4',
      difficultyLevel: 2,
      skillTags: ['algebra', 'linear_equations']
    },
    {
      id: 'q2',
      type: 'multiple_choice', 
      text: 'What is the area of a circle with radius 5?',
      options: ['25π', '10π', '5π', '50π'],
      correctAnswer: '25π',
      difficultyLevel: 3,
      skillTags: ['geometry', 'circles']
    },
    {
      id: 'q3',
      type: 'multiple_choice',
      text: 'If y = 2x + 3, what is y when x = 4?',
      options: ['8', '9', '11', '14'],
      correctAnswer: '11',
      difficultyLevel: 2,
      skillTags: ['algebra', 'functions']
    },
    {
      id: 'q4',
      type: 'multiple_choice',
      text: 'What is the median of: 3, 7, 2, 9, 5?',
      options: ['3', '5', '7', '9'],
      correctAnswer: '5',
      difficultyLevel: 3,
      skillTags: ['statistics', 'median']
    },
    {
      id: 'q5',
      type: 'multiple_choice',
      text: 'Solve: 3x - 7 = 2x + 8',
      options: ['x = 1', 'x = 15', 'x = -1', 'x = -15'],
      correctAnswer: 'x = 15',
      difficultyLevel: 4,
      skillTags: ['algebra', 'linear_equations']
    }
  ]
};

tests[sampleMathTest.id] = sampleMathTest;

// Simple IRT implementation for demo
function calculateAbility(responses) {
  const correctCount = responses.filter(r => r.correct).length;
  const totalCount = responses.length;
  if (totalCount === 0) return 0;
  
  // Simple logistic model approximation
  const pCorrect = correctCount / totalCount;
  if (pCorrect >= 0.99) return 3.0;
  if (pCorrect <= 0.01) return -3.0;
  
  // Convert probability to ability estimate
  return Math.log(pCorrect / (1 - pCorrect));
}

function selectNextQuestion(ability, answeredQuestionIds, testQuestions) {
  const availableQuestions = testQuestions.filter(q => 
    !answeredQuestionIds.includes(q.id)
  );
  
  if (availableQuestions.length === 0) return null;
  
  // Simple difficulty matching (in real IRT this would be more sophisticated)
  const targetDifficulty = Math.max(1, Math.min(5, Math.round(3 + ability)));
  
  // Find question closest to target difficulty
  let bestQuestion = availableQuestions[0];
  let minDifference = Math.abs(bestQuestion.difficultyLevel - targetDifficulty);
  
  for (const question of availableQuestions) {
    const difference = Math.abs(question.difficultyLevel - targetDifficulty);
    if (difference < minDifference) {
      minDifference = difference;
      bestQuestion = question;
    }
  }
  
  return bestQuestion;
}

// API Endpoints

// Get available tests
app.get('/api/tests', (req, res) => {
  const testList = Object.values(tests).map(test => ({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    gradeLevel: test.gradeLevel,
    timeLimit: test.timeLimit,
    questionCount: test.questionCount,
    createdAt: test.createdAt
  }));
  
  res.json({
    success: true,
    tests: testList,
    pagination: {
      total: testList.length,
      limit: 20,
      offset: 0,
      hasMore: false
    }
  });
});

// Get test details
app.get('/api/tests/:testId', (req, res) => {
  const { testId } = req.params;
  const test = tests[testId];
  
  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }
  
  // Don't include questions with correct answers for security
  const safeQuestions = test.questions.map(q => ({
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options,
    skillTags: q.skillTags,
    difficultyLevel: q.difficultyLevel
  }));
  
  res.json({
    success: true,
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      subject: test.subject,
      gradeLevel: test.gradeLevel,
      timeLimit: test.timeLimit,
      questionCount: test.questionCount,
      createdAt: test.createdAt
    },
    questions: safeQuestions,
    statistics: {
      totalSessions: 0,
      completedSessions: 0,
      averageAbility: 0.0
    }
  });
});

// Start test session
app.post('/api/test-sessions', (req, res) => {
  const { testId, studentId } = req.body;
  
  if (!testId || !studentId) {
    return res.status(400).json({
      success: false,
      error: 'testId and studentId are required'
    });
  }
  
  const test = tests[testId];
  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }
  
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    testId,
    studentId,
    status: 'active',
    startedAt: new Date().toISOString(),
    timeRemaining: test.timeLimit * 60, // Convert to seconds
    estimatedAbility: 0.0,
    answeredQuestions: []
  };
  
  sessions[sessionId] = session;
  answers[sessionId] = [];
  
  // Select first question
  const firstQuestion = selectNextQuestion(0.0, [], test.questions);
  
  res.json({
    success: true,
    sessionId,
    testId,
    testTitle: test.title,
    timeRemaining: session.timeRemaining,
    currentQuestion: {
      id: firstQuestion.id,
      type: firstQuestion.type,
      text: firstQuestion.text,
      options: firstQuestion.options,
      difficultyLevel: firstQuestion.difficultyLevel,
      skillTags: firstQuestion.skillTags
    },
    questionNumber: 1,
    totalQuestions: test.questionCount,
    estimatedAbility: 0.0
  });
});

// Submit answer
app.post('/api/test-sessions/:sessionId/answers', (req, res) => {
  const { sessionId } = req.params;
  const { questionId, answer, timeSpent, confidenceLevel } = req.body;
  
  const session = sessions[sessionId];
  if (!session || session.status !== 'active') {
    return res.status(404).json({
      success: false,
      error: 'Active test session not found'
    });
  }
  
  const test = tests[session.testId];
  const question = test.questions.find(q => q.id === questionId);
  
  if (!question) {
    return res.status(404).json({
      success: false,
      error: 'Question not found'
    });
  }
  
  const isCorrect = answer === question.correctAnswer;
  
  // Save answer
  const answerRecord = {
    id: uuidv4(),
    sessionId,
    questionId,
    answer,
    isCorrect,
    timeSpent,
    confidenceLevel,
    answeredAt: new Date().toISOString()
  };
  
  answers[sessionId].push(answerRecord);
  session.answeredQuestions.push(questionId);
  
  // Update ability estimate
  const responses = answers[sessionId].map(a => ({
    correct: a.isCorrect,
    timeSpent: a.timeSpent
  }));
  
  session.estimatedAbility = calculateAbility(responses);
  
  // Check if test should end
  const maxQuestions = Math.min(15, test.questions.length);
  const minQuestions = 5;
  const answeredCount = answers[sessionId].length;
  
  let testCompleted = false;
  let nextQuestion = null;
  
  if (answeredCount >= maxQuestions || answeredCount >= minQuestions) {
    // Complete the test
    testCompleted = true;
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    
    const correctCount = answers[sessionId].filter(a => a.isCorrect).length;
    const scaledScore = Math.round(50 + 10 * session.estimatedAbility);
    
    res.json({
      success: true,
      isCorrect,
      testCompleted: true,
      sessionId,
      finalResults: {
        estimatedAbility: session.estimatedAbility,
        scaledScore: Math.max(0, Math.min(100, scaledScore)),
        standardError: 0.5, // Mock value
        confidenceInterval: {
          lower: Math.max(0, scaledScore - 10),
          upper: Math.min(100, scaledScore + 10)
        },
        totalItems: answeredCount,
        correctCount,
        rawScore: Math.round((correctCount / answeredCount) * 100),
        reliability: 85
      }
    });
  } else {
    // Select next question
    nextQuestion = selectNextQuestion(session.estimatedAbility, session.answeredQuestions, test.questions);
    
    res.json({
      success: true,
      isCorrect,
      testCompleted: false,
      sessionId,
      estimatedAbility: session.estimatedAbility,
      scaledScore: Math.round(50 + 10 * session.estimatedAbility),
      nextQuestion: nextQuestion ? {
        id: nextQuestion.id,
        type: nextQuestion.type,
        text: nextQuestion.text,
        options: nextQuestion.options,
        difficultyLevel: nextQuestion.difficultyLevel,
        skillTags: nextQuestion.skillTags
      } : null,
      questionNumber: answeredCount + 1,
      progress: {
        answeredQuestions: answeredCount,
        estimatedRemaining: maxQuestions - answeredCount
      }
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: ['test-engine'],
    version: '1.0.0',
    activeSessions: Object.keys(sessions).filter(id => sessions[id].status === 'active').length
  });
});

app.listen(port, () => {
  console.log(`🚀 EduLens Test Engine running at http://localhost:${port}`);
  console.log(`📝 Available endpoints:`);
  console.log(`   GET /api/tests - List available tests`);
  console.log(`   GET /api/tests/:testId - Get test details`);
  console.log(`   POST /api/test-sessions - Start test session`);
  console.log(`   POST /api/test-sessions/:sessionId/answers - Submit answer`);
  console.log(`   GET /health - Health check`);
  console.log(``);
  console.log(`🎯 Sample Test Available:`);
  console.log(`   📊 ${sampleMathTest.title}`);
  console.log(`   📖 ${sampleMathTest.description}`);
  console.log(`   🎓 Grade ${sampleMathTest.gradeLevel}`);
  console.log(`   ⏱️  ${sampleMathTest.timeLimit} minutes`);
  console.log(`   📋 ${sampleMathTest.questions.length} questions`);
  console.log(``);
  console.log(`🎯 Frontend: http://localhost:3000`);
  console.log(`🔧 Backend: http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test engine server...');
  process.exit(0);
});