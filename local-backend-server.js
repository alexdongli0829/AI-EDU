#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// In-memory storage (replace with real database in production)
const sessions = {};
const messages = {};

// Mock AI response generator
function generateAIResponse(userMessage, chatHistory) {
  const responses = [
    `Thank you for sharing that with me. Based on what you've told me about your child's learning, I'd suggest focusing on ${userMessage.toLowerCase().includes('math') ? 'building confidence through practice with smaller, manageable problems' : 'creating a structured learning environment at home'}.`,
    `That's a great question! Every child learns differently. For this situation, I recommend ${userMessage.toLowerCase().includes('reading') ? 'setting up a daily reading routine with books they find interesting' : 'using visual aids and hands-on activities to make learning more engaging'}.`,
    `I understand your concern. Many parents face similar challenges. Here are some strategies that often work well: 1) Break tasks into smaller steps, 2) Celebrate small wins, 3) Be patient and consistent. What specific area would you like to focus on first?`,
    `From what you're describing, your child seems to be on a good learning path. Consider ${userMessage.toLowerCase().includes('challenge') ? 'introducing slightly more advanced materials to keep them engaged' : 'maintaining the current approach while adding variety to keep learning fun'}.`,
    `That's a common situation. I'd recommend trying a different approach: ${userMessage.toLowerCase().includes('difficult') ? 'breaking down difficult concepts into bite-sized pieces' : 'finding ways to connect the learning to your child\'s interests'}. Would you like more specific suggestions?`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Create chat session
app.post('/api/parent-chat/session', (req, res) => {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    parentId: req.body.parentId || 'test-parent',
    studentId: req.body.studentId || 'test-student',
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  sessions[sessionId] = session;
  messages[sessionId] = [];
  
  console.log(`Created session: ${sessionId}`);
  
  res.json({
    success: true,
    session: session
  });
});

// Send message to chat
app.post('/api/parent-chat/:sessionId/message', async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  
  if (!sessions[sessionId] || sessions[sessionId].status !== 'active') {
    return res.status(404).json({
      success: false,
      error: 'Chat session not found or inactive'
    });
  }
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }
  
  // Add user message
  const userMessage = {
    id: uuidv4(),
    sessionId,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  messages[sessionId].push(userMessage);
  
  // Generate AI response
  const aiResponseContent = generateAIResponse(message, messages[sessionId]);
  
  const aiMessage = {
    id: uuidv4(),
    sessionId,
    role: 'assistant',
    content: aiResponseContent,
    timestamp: new Date().toISOString()
  };
  
  messages[sessionId].push(aiMessage);
  
  console.log(`Message sent in session ${sessionId}: "${message}"`);
  console.log(`AI Response: "${aiResponseContent}"`);
  
  res.json({
    success: true,
    userMessageId: userMessage.id,
    assistantMessageId: aiMessage.id,
    response: aiResponseContent
  });
});

// Get messages
app.get('/api/parent-chat/:sessionId/messages', (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({
      success: false,
      error: 'Chat session not found'
    });
  }
  
  const sessionMessages = messages[sessionId] || [];
  const paginatedMessages = sessionMessages.slice(offset, offset + limit);
  
  res.json({
    success: true,
    messages: paginatedMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }))
  });
});

// End session
app.post('/api/parent-chat/:sessionId/end', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({
      success: false,
      error: 'Chat session not found'
    });
  }
  
  sessions[sessionId].status = 'ended';
  sessions[sessionId].endedAt = new Date().toISOString();
  
  console.log(`Session ended: ${sessionId}`);
  
  res.json({
    success: true,
    message: 'Session ended successfully'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(sessions).filter(id => sessions[id].status === 'active').length
  });
});

app.listen(port, () => {
  console.log(`🚀 EduLens Local Backend running at http://localhost:${port}`);
  console.log(`📝 Conversation API endpoints:`);
  console.log(`   POST /api/parent-chat/session - Create chat session`);
  console.log(`   POST /api/parent-chat/:sessionId/message - Send message`);
  console.log(`   GET /api/parent-chat/:sessionId/messages - Get messages`);
  console.log(`   POST /api/parent-chat/:sessionId/end - End session`);
  console.log(`   GET /health - Health check`);
  console.log(``);
  console.log(`🎯 Frontend: http://localhost:3000`);
  console.log(`🔧 Backend: http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down local backend server...');
  process.exit(0);
});