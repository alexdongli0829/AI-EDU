/**
 * Generated realistic test data for NSW OC/Selective exam preparation.
 * 5 students, 50 questions, test sessions, conversation histories, and memory records.
 */

import type {
  StudentData,
  QuestionData,
  TestSession,
  ConversationHistory,
  MemoryRecord,
} from '../shared/types.js';

// ── 5 Students ──────────────────────────────────────────────────

export const STUDENTS: readonly StudentData[] = [
  {
    studentId: 'stu-001',
    name: 'Mia Chen',
    gradeLevel: 4,
    overallMastery: 68,
    strengths: ['reading.inference', 'reading.vocabulary'],
    weaknesses: ['math.number_patterns', 'thinking.spatial'],
    testHistory: [
      { title: 'OC Practice Test 1', date: '2026-02-01', score: 65, correct: 26, total: 40 },
      { title: 'OC Practice Test 2', date: '2026-02-15', score: 68, correct: 27, total: 40 },
      { title: 'OC Practice Test 3', date: '2026-03-01', score: 72, correct: 29, total: 40 },
      { title: 'OC Practice Test 4', date: '2026-03-15', score: 70, correct: 28, total: 40 },
    ],
    skillBreakdown: {
      reading: { inference: 82, vocabulary: 78, comprehension: 70, main_idea: 65 },
      math: { number_patterns: 45, fractions: 55, geometry: 50, word_problems: 60 },
      thinking: { spatial: 40, analogies: 55, logic: 60, classification: 65 },
    },
    timeBehavior: { avgTimePerQuestion: 48, rushingIndicator: 35, staminaCurve: 'declining', fastAnswers: 8 },
    errorPatterns: [
      { type: 'careless_errors', frequency: 12, severity: 'medium' },
      { type: 'time_pressure', frequency: 8, severity: 'high' },
      { type: 'concept_gaps', frequency: 5, severity: 'high' },
      { type: 'misreading', frequency: 3, severity: 'low' },
    ],
  },
  {
    studentId: 'stu-002',
    name: 'Liam Park',
    gradeLevel: 4,
    overallMastery: 82,
    strengths: ['math.number_patterns', 'math.geometry', 'thinking.logic'],
    weaknesses: ['reading.inference', 'reading.vocabulary'],
    testHistory: [
      { title: 'OC Practice Test 1', date: '2026-02-01', score: 78, correct: 31, total: 40 },
      { title: 'OC Practice Test 2', date: '2026-02-15', score: 80, correct: 32, total: 40 },
      { title: 'OC Practice Test 3', date: '2026-03-01', score: 82, correct: 33, total: 40 },
      { title: 'OC Practice Test 4', date: '2026-03-15', score: 85, correct: 34, total: 40 },
    ],
    skillBreakdown: {
      reading: { inference: 58, vocabulary: 55, comprehension: 65, main_idea: 70 },
      math: { number_patterns: 92, fractions: 88, geometry: 90, word_problems: 85 },
      thinking: { spatial: 78, analogies: 75, logic: 88, classification: 80 },
    },
    timeBehavior: { avgTimePerQuestion: 38, rushingIndicator: 15, staminaCurve: 'steady', fastAnswers: 3 },
    errorPatterns: [
      { type: 'vocabulary_gaps', frequency: 10, severity: 'high' },
      { type: 'inference_errors', frequency: 7, severity: 'medium' },
      { type: 'careless_errors', frequency: 3, severity: 'low' },
    ],
  },
  {
    studentId: 'stu-003',
    name: 'Aisha Rahman',
    gradeLevel: 4,
    overallMastery: 75,
    strengths: ['reading.comprehension', 'thinking.analogies', 'thinking.classification'],
    weaknesses: ['math.fractions', 'math.word_problems', 'thinking.spatial'],
    testHistory: [
      { title: 'OC Practice Test 1', date: '2026-02-01', score: 70, correct: 28, total: 40 },
      { title: 'OC Practice Test 2', date: '2026-02-15', score: 73, correct: 29, total: 40 },
      { title: 'OC Practice Test 3', date: '2026-03-01', score: 75, correct: 30, total: 40 },
      { title: 'OC Practice Test 4', date: '2026-03-15', score: 78, correct: 31, total: 40 },
    ],
    skillBreakdown: {
      reading: { inference: 72, vocabulary: 70, comprehension: 85, main_idea: 80 },
      math: { number_patterns: 68, fractions: 50, geometry: 65, word_problems: 52 },
      thinking: { spatial: 48, analogies: 82, logic: 75, classification: 80 },
    },
    timeBehavior: { avgTimePerQuestion: 52, rushingIndicator: 20, staminaCurve: 'steady', fastAnswers: 4 },
    errorPatterns: [
      { type: 'fraction_operations', frequency: 9, severity: 'high' },
      { type: 'word_problem_setup', frequency: 6, severity: 'medium' },
      { type: 'spatial_rotation', frequency: 5, severity: 'medium' },
    ],
  },
  {
    studentId: 'stu-004',
    name: 'Oliver Smith',
    gradeLevel: 4,
    overallMastery: 55,
    strengths: ['thinking.spatial', 'thinking.logic'],
    weaknesses: ['reading.comprehension', 'reading.vocabulary', 'math.fractions', 'math.word_problems'],
    testHistory: [
      { title: 'OC Practice Test 1', date: '2026-02-01', score: 48, correct: 19, total: 40 },
      { title: 'OC Practice Test 2', date: '2026-02-15', score: 52, correct: 21, total: 40 },
      { title: 'OC Practice Test 3', date: '2026-03-01', score: 55, correct: 22, total: 40 },
      { title: 'OC Practice Test 4', date: '2026-03-15', score: 58, correct: 23, total: 40 },
    ],
    skillBreakdown: {
      reading: { inference: 42, vocabulary: 38, comprehension: 45, main_idea: 50 },
      math: { number_patterns: 55, fractions: 40, geometry: 60, word_problems: 42 },
      thinking: { spatial: 72, analogies: 55, logic: 70, classification: 58 },
    },
    timeBehavior: { avgTimePerQuestion: 62, rushingIndicator: 45, staminaCurve: 'declining', fastAnswers: 12 },
    errorPatterns: [
      { type: 'reading_comprehension', frequency: 15, severity: 'high' },
      { type: 'vocabulary_gaps', frequency: 12, severity: 'high' },
      { type: 'time_pressure', frequency: 10, severity: 'high' },
      { type: 'careless_errors', frequency: 8, severity: 'medium' },
    ],
  },
  {
    studentId: 'stu-005',
    name: 'Sophie Liu',
    gradeLevel: 4,
    overallMastery: 90,
    strengths: ['reading.inference', 'reading.comprehension', 'math.number_patterns', 'thinking.logic'],
    weaknesses: ['thinking.spatial'],
    testHistory: [
      { title: 'OC Practice Test 1', date: '2026-02-01', score: 88, correct: 35, total: 40 },
      { title: 'OC Practice Test 2', date: '2026-02-15', score: 90, correct: 36, total: 40 },
      { title: 'OC Practice Test 3', date: '2026-03-01', score: 90, correct: 36, total: 40 },
      { title: 'OC Practice Test 4', date: '2026-03-15', score: 92, correct: 37, total: 40 },
    ],
    skillBreakdown: {
      reading: { inference: 95, vocabulary: 88, comprehension: 92, main_idea: 90 },
      math: { number_patterns: 92, fractions: 85, geometry: 82, word_problems: 88 },
      thinking: { spatial: 65, analogies: 88, logic: 92, classification: 90 },
    },
    timeBehavior: { avgTimePerQuestion: 35, rushingIndicator: 10, staminaCurve: 'steady', fastAnswers: 2 },
    errorPatterns: [
      { type: 'spatial_rotation', frequency: 4, severity: 'medium' },
      { type: 'careless_errors', frequency: 2, severity: 'low' },
    ],
  },
];

// ── 50 Questions across reading / math / thinking ───────────────

export const QUESTIONS: readonly QuestionData[] = [
  // READING (15 questions)
  { questionId: 'q-r-001', text: 'Sarah walked into the kitchen and found flour all over the bench, eggshells in the sink, and a warm smell filling the room. What can you infer happened?', options: [{ label: 'A', text: 'Sarah made a mess in the kitchen', isCorrect: false }, { label: 'B', text: 'Someone had been baking', isCorrect: true }, { label: 'C', text: 'The kitchen was being cleaned', isCorrect: false }, { label: 'D', text: 'Sarah was cooking dinner', isCorrect: false }], correctAnswer: 'B', explanation: 'Flour, eggshells, and a warm smell are all clues that point to baking.', skillTags: ['reading.inference'], difficulty: 'easy', estimatedTime: 45, subject: 'reading' },
  { questionId: 'q-r-002', text: 'Tom stared at the blank page. He chewed the end of his pencil and glanced at the clock. The teacher announced, "Five minutes remaining." Tom began to write quickly. What can we infer about Tom?', options: [{ label: 'A', text: 'Tom is an excellent writer', isCorrect: false }, { label: 'B', text: 'Tom had been struggling to start his writing task', isCorrect: true }, { label: 'C', text: 'Tom finished his work early', isCorrect: false }, { label: 'D', text: 'Tom does not like writing', isCorrect: false }], correctAnswer: 'B', explanation: 'The blank page, pencil chewing, and clock watching show Tom was having difficulty starting.', skillTags: ['reading.inference'], difficulty: 'easy', estimatedTime: 45, subject: 'reading' },
  { questionId: 'q-r-003', text: '"The old house at the end of Maple Street had not been painted in years. Weeds grew through the cracks in the path, and the windows were dark even during the day." The author\'s purpose is most likely to:', options: [{ label: 'A', text: 'Create a feeling of mystery or neglect', isCorrect: true }, { label: 'B', text: 'Describe a new house being built', isCorrect: false }, { label: 'C', text: 'Show a happy neighbourhood', isCorrect: false }, { label: 'D', text: 'Explain why houses need painting', isCorrect: false }], correctAnswer: 'A', explanation: 'The unpainted walls, weeds, and dark windows all create an atmosphere of neglect and mystery.', skillTags: ['reading.inference', 'reading.comprehension'], difficulty: 'medium', estimatedTime: 60, subject: 'reading' },
  { questionId: 'q-r-004', text: '"Maya carefully placed each photograph into the album, pausing to smile at some and wiping her eyes at others." What does this tell us about the photographs?', options: [{ label: 'A', text: 'They are all brand new photos', isCorrect: false }, { label: 'B', text: 'They bring back different memories and emotions', isCorrect: true }, { label: 'C', text: 'Maya does not like the photographs', isCorrect: false }, { label: 'D', text: 'The photographs are damaged', isCorrect: false }], correctAnswer: 'B', explanation: 'Maya smiling at some and wiping her eyes at others shows different emotional reactions to various memories.', skillTags: ['reading.inference'], difficulty: 'medium', estimatedTime: 50, subject: 'reading' },
  { questionId: 'q-r-005', text: 'Which word best replaces "abundant" in: "The garden had an abundant supply of tomatoes this summer."', options: [{ label: 'A', text: 'small', isCorrect: false }, { label: 'B', text: 'plentiful', isCorrect: true }, { label: 'C', text: 'expensive', isCorrect: false }, { label: 'D', text: 'colourful', isCorrect: false }], correctAnswer: 'B', explanation: '"Abundant" means existing in large quantities. "Plentiful" is the best synonym.', skillTags: ['reading.vocabulary'], difficulty: 'easy', estimatedTime: 30, subject: 'reading' },
  { questionId: 'q-r-006', text: 'What does "reluctant" mean in: "Jake was reluctant to jump into the cold pool."', options: [{ label: 'A', text: 'Excited and eager', isCorrect: false }, { label: 'B', text: 'Unwilling or hesitant', isCorrect: true }, { label: 'C', text: 'Angry and upset', isCorrect: false }, { label: 'D', text: 'Confused and lost', isCorrect: false }], correctAnswer: 'B', explanation: '"Reluctant" means not willing or hesitant to do something.', skillTags: ['reading.vocabulary'], difficulty: 'easy', estimatedTime: 30, subject: 'reading' },
  { questionId: 'q-r-007', text: '"The town of Millbrook relied on the river for its water supply. When the factory upstream began dumping waste, the townspeople noticed their water had changed colour." What is the main idea?', options: [{ label: 'A', text: 'Rivers are important for fishing', isCorrect: false }, { label: 'B', text: 'Factories are good for towns', isCorrect: false }, { label: 'C', text: 'Industrial pollution can affect a community\'s water supply', isCorrect: true }, { label: 'D', text: 'Water always changes colour in summer', isCorrect: false }], correctAnswer: 'C', explanation: 'The passage connects factory waste to changed water colour, showing how pollution impacts the community.', skillTags: ['reading.main_idea', 'reading.comprehension'], difficulty: 'medium', estimatedTime: 60, subject: 'reading' },
  { questionId: 'q-r-008', text: '"The koala clung to the highest branch, its eyes wide. Below, the bushfire crackled through the undergrowth." Which word best describes the koala\'s likely emotion?', options: [{ label: 'A', text: 'Curious', isCorrect: false }, { label: 'B', text: 'Frightened', isCorrect: true }, { label: 'C', text: 'Sleepy', isCorrect: false }, { label: 'D', text: 'Hungry', isCorrect: false }], correctAnswer: 'B', explanation: 'Clinging to the highest branch with wide eyes while a bushfire approaches shows fear.', skillTags: ['reading.inference'], difficulty: 'easy', estimatedTime: 40, subject: 'reading' },
  { questionId: 'q-r-009', text: '"Despite the team\'s valiant effort, the final score did not reflect their improvement." What does "valiant" most likely mean?', options: [{ label: 'A', text: 'Lazy', isCorrect: false }, { label: 'B', text: 'Brave and determined', isCorrect: true }, { label: 'C', text: 'Careless', isCorrect: false }, { label: 'D', text: 'Quiet', isCorrect: false }], correctAnswer: 'B', explanation: '"Valiant" means showing courage and determination.', skillTags: ['reading.vocabulary'], difficulty: 'medium', estimatedTime: 40, subject: 'reading' },
  { questionId: 'q-r-010', text: '"First, gather all your materials. Next, measure the ingredients carefully. Then, mix them in the correct order. Finally, bake at 180 degrees for 25 minutes." What type of text is this?', options: [{ label: 'A', text: 'A narrative story', isCorrect: false }, { label: 'B', text: 'A persuasive argument', isCorrect: false }, { label: 'C', text: 'A set of procedural instructions', isCorrect: true }, { label: 'D', text: 'A poem', isCorrect: false }], correctAnswer: 'C', explanation: 'Sequential steps and action verbs identify this as procedural writing.', skillTags: ['reading.comprehension', 'reading.main_idea'], difficulty: 'easy', estimatedTime: 35, subject: 'reading' },
  { questionId: 'q-r-011', text: 'The ancient library of Alexandria was one of the largest libraries of the ancient world. Scholars from across the Mediterranean traveled there. What can we infer about Alexandria?', options: [{ label: 'A', text: 'It was the capital of Egypt', isCorrect: false }, { label: 'B', text: 'It was an important center of learning', isCorrect: true }, { label: 'C', text: 'It was the largest city', isCorrect: false }, { label: 'D', text: 'It was only for Egyptian scholars', isCorrect: false }], correctAnswer: 'B', explanation: 'Scholars traveling from across the Mediterranean indicates it was a major center of learning.', skillTags: ['reading.inference'], difficulty: 'medium', estimatedTime: 55, subject: 'reading' },
  { questionId: 'q-r-012', text: '"Despite the storm\'s fury, the lighthouse keeper maintained his vigil throughout the night." Which word is closest in meaning to "vigil"?', options: [{ label: 'A', text: 'Sleep', isCorrect: false }, { label: 'B', text: 'Watch', isCorrect: true }, { label: 'C', text: 'Rest', isCorrect: false }, { label: 'D', text: 'Work', isCorrect: false }], correctAnswer: 'B', explanation: 'Vigil means a period of keeping awake to keep watch.', skillTags: ['reading.vocabulary'], difficulty: 'medium', estimatedTime: 45, subject: 'reading' },
  { questionId: 'q-r-013', text: 'The researcher observed that birds migrated south in autumn, returned north in spring, and nested in the same trees each year. When do the birds return north?', options: [{ label: 'A', text: 'Summer', isCorrect: false }, { label: 'B', text: 'Winter', isCorrect: false }, { label: 'C', text: 'Spring', isCorrect: true }, { label: 'D', text: 'Autumn', isCorrect: false }], correctAnswer: 'C', explanation: 'The passage directly states the birds "returned north in spring".', skillTags: ['reading.comprehension'], difficulty: 'easy', estimatedTime: 30, subject: 'reading' },
  { questionId: 'q-r-014', text: '"Though the experiment failed initially, the scientist\'s perseverance led to a breakthrough." What does "perseverance" mean?', options: [{ label: 'A', text: 'Intelligence', isCorrect: false }, { label: 'B', text: 'Luck', isCorrect: false }, { label: 'C', text: 'Persistence despite difficulties', isCorrect: true }, { label: 'D', text: 'Speed', isCorrect: false }], correctAnswer: 'C', explanation: 'Perseverance means continuing to try despite failure.', skillTags: ['reading.vocabulary'], difficulty: 'medium', estimatedTime: 40, subject: 'reading' },
  { questionId: 'q-r-015', text: 'A character learns honesty is more valuable than wealth when she returns a lost treasure. What is the main theme?', options: [{ label: 'A', text: 'Adventure', isCorrect: false }, { label: 'B', text: 'The importance of honesty', isCorrect: true }, { label: 'C', text: 'Finding treasure', isCorrect: false }, { label: 'D', text: 'Making friends', isCorrect: false }], correctAnswer: 'B', explanation: 'The theme is honesty over wealth, shown by the character returning the treasure.', skillTags: ['reading.main_idea'], difficulty: 'easy', estimatedTime: 40, subject: 'reading' },

  // MATH (20 questions)
  { questionId: 'q-m-001', text: 'If the pattern continues: 2, 6, 18, 54, ?, what is the next number?', options: [{ label: 'A', text: '108', isCorrect: false }, { label: 'B', text: '162', isCorrect: true }, { label: 'C', text: '216', isCorrect: false }, { label: 'D', text: '72', isCorrect: false }], correctAnswer: 'B', explanation: 'Each number is multiplied by 3. 54×3=162.', skillTags: ['math.number_patterns'], difficulty: 'medium', estimatedTime: 45, subject: 'math' },
  { questionId: 'q-m-002', text: 'What is the next number: 1, 4, 9, 16, 25, ?', options: [{ label: 'A', text: '30', isCorrect: false }, { label: 'B', text: '36', isCorrect: true }, { label: 'C', text: '35', isCorrect: false }, { label: 'D', text: '49', isCorrect: false }], correctAnswer: 'B', explanation: 'Perfect squares: 1²=1, 2²=4, ... 6²=36.', skillTags: ['math.number_patterns'], difficulty: 'medium', estimatedTime: 45, subject: 'math' },
  { questionId: 'q-m-003', text: 'Find the missing number: 3, 7, 15, 31, ?', options: [{ label: 'A', text: '47', isCorrect: false }, { label: 'B', text: '55', isCorrect: false }, { label: 'C', text: '63', isCorrect: true }, { label: 'D', text: '62', isCorrect: false }], correctAnswer: 'C', explanation: 'Pattern: multiply by 2 and add 1. 31×2+1=63.', skillTags: ['math.number_patterns'], difficulty: 'hard', estimatedTime: 60, subject: 'math' },
  { questionId: 'q-m-004', text: 'What is ¾ + ½?', options: [{ label: 'A', text: '4/6', isCorrect: false }, { label: 'B', text: '1¼', isCorrect: true }, { label: 'C', text: '5/6', isCorrect: false }, { label: 'D', text: '1½', isCorrect: false }], correctAnswer: 'B', explanation: '¾ + ²⁄₄ = ⁵⁄₄ = 1¼.', skillTags: ['math.fractions'], difficulty: 'easy', estimatedTime: 40, subject: 'math' },
  { questionId: 'q-m-005', text: 'What is ⅔ of 24?', options: [{ label: 'A', text: '12', isCorrect: false }, { label: 'B', text: '16', isCorrect: true }, { label: 'C', text: '18', isCorrect: false }, { label: 'D', text: '8', isCorrect: false }], correctAnswer: 'B', explanation: '24 ÷ 3 × 2 = 16.', skillTags: ['math.fractions'], difficulty: 'easy', estimatedTime: 35, subject: 'math' },
  { questionId: 'q-m-006', text: 'A rectangle has a perimeter of 30 cm. If the length is 9 cm, what is the width?', options: [{ label: 'A', text: '6 cm', isCorrect: true }, { label: 'B', text: '7 cm', isCorrect: false }, { label: 'C', text: '12 cm', isCorrect: false }, { label: 'D', text: '21 cm', isCorrect: false }], correctAnswer: 'A', explanation: '30 = 2×(9+w), 15=9+w, w=6.', skillTags: ['math.geometry'], difficulty: 'easy', estimatedTime: 45, subject: 'math' },
  { questionId: 'q-m-007', text: 'Sam had 48 stickers. He gave ¼ to his sister and ⅓ of the remainder to his friend. How many does Sam have now?', options: [{ label: 'A', text: '20', isCorrect: false }, { label: 'B', text: '24', isCorrect: true }, { label: 'C', text: '28', isCorrect: false }, { label: 'D', text: '16', isCorrect: false }], correctAnswer: 'B', explanation: '¼ of 48=12 to sister. Remainder=36. ⅓ of 36=12 to friend. Left: 24.', skillTags: ['math.word_problems', 'math.fractions'], difficulty: 'medium', estimatedTime: 60, subject: 'math' },
  { questionId: 'q-m-008', text: 'A train travels 240 km in 3 hours. How far in 5 hours at the same speed?', options: [{ label: 'A', text: '350 km', isCorrect: false }, { label: 'B', text: '400 km', isCorrect: true }, { label: 'C', text: '380 km', isCorrect: false }, { label: 'D', text: '480 km', isCorrect: false }], correctAnswer: 'B', explanation: 'Speed=80 km/h. 80×5=400.', skillTags: ['math.word_problems'], difficulty: 'medium', estimatedTime: 50, subject: 'math' },
  { questionId: 'q-m-009', text: 'Area of a triangle with base 10 cm and height 6 cm?', options: [{ label: 'A', text: '60 cm²', isCorrect: false }, { label: 'B', text: '30 cm²', isCorrect: true }, { label: 'C', text: '16 cm²', isCorrect: false }, { label: 'D', text: '40 cm²', isCorrect: false }], correctAnswer: 'B', explanation: '½×10×6=30 cm².', skillTags: ['math.geometry'], difficulty: 'easy', estimatedTime: 35, subject: 'math' },
  { questionId: 'q-m-010', text: 'Which fraction is equivalent to 0.75?', options: [{ label: 'A', text: '⅔', isCorrect: false }, { label: 'B', text: '¾', isCorrect: true }, { label: 'C', text: '⅗', isCorrect: false }, { label: 'D', text: '⅞', isCorrect: false }], correctAnswer: 'B', explanation: '0.75 = 75/100 = ¾.', skillTags: ['math.fractions'], difficulty: 'easy', estimatedTime: 30, subject: 'math' },
  { questionId: 'q-m-011', text: 'A pizza is cut into 8 slices. Emma eats 3, Zoe eats 2. What fraction is left?', options: [{ label: 'A', text: '⅛', isCorrect: false }, { label: 'B', text: '⅜', isCorrect: true }, { label: 'C', text: '½', isCorrect: false }, { label: 'D', text: '⅝', isCorrect: false }], correctAnswer: 'B', explanation: '8-5=3 slices left = ⅜.', skillTags: ['math.fractions'], difficulty: 'easy', estimatedTime: 35, subject: 'math' },
  { questionId: 'q-m-012', text: 'How many lines of symmetry does a regular hexagon have?', options: [{ label: 'A', text: '3', isCorrect: false }, { label: 'B', text: '4', isCorrect: false }, { label: 'C', text: '6', isCorrect: true }, { label: 'D', text: '8', isCorrect: false }], correctAnswer: 'C', explanation: 'A regular hexagon has 6 lines of symmetry.', skillTags: ['math.geometry'], difficulty: 'medium', estimatedTime: 40, subject: 'math' },
  { questionId: 'q-m-013', text: 'Next number: 100, 91, 83, 76, 70, ?', options: [{ label: 'A', text: '64', isCorrect: false }, { label: 'B', text: '65', isCorrect: true }, { label: 'C', text: '63', isCorrect: false }, { label: 'D', text: '60', isCorrect: false }], correctAnswer: 'B', explanation: 'Differences decrease: -9,-8,-7,-6,-5. 70-5=65.', skillTags: ['math.number_patterns'], difficulty: 'hard', estimatedTime: 55, subject: 'math' },
  { questionId: 'q-m-014', text: '25% off a $80 jacket. Sale price?', options: [{ label: 'A', text: '$55', isCorrect: false }, { label: 'B', text: '$60', isCorrect: true }, { label: 'C', text: '$65', isCorrect: false }, { label: 'D', text: '$20', isCorrect: false }], correctAnswer: 'B', explanation: '25% of $80=$20. $80-$20=$60.', skillTags: ['math.word_problems', 'math.fractions'], difficulty: 'medium', estimatedTime: 45, subject: 'math' },
  { questionId: 'q-m-015', text: 'Volume of rectangular prism: length 5cm, width 3cm, height 4cm?', options: [{ label: 'A', text: '12 cm³', isCorrect: false }, { label: 'B', text: '60 cm³', isCorrect: true }, { label: 'C', text: '24 cm³', isCorrect: false }, { label: 'D', text: '47 cm³', isCorrect: false }], correctAnswer: 'B', explanation: '5×3×4=60 cm³.', skillTags: ['math.geometry'], difficulty: 'easy', estimatedTime: 30, subject: 'math' },
  { questionId: 'q-m-016', text: 'If 3x + 7 = 22, what is x?', options: [{ label: 'A', text: '3', isCorrect: false }, { label: 'B', text: '5', isCorrect: true }, { label: 'C', text: '7', isCorrect: false }, { label: 'D', text: '10', isCorrect: false }], correctAnswer: 'B', explanation: '3x=15, x=5.', skillTags: ['math.word_problems'], difficulty: 'medium', estimatedTime: 40, subject: 'math' },
  { questionId: 'q-m-017', text: 'A clock shows 3:45. What angle do the hands make?', options: [{ label: 'A', text: '172.5°', isCorrect: false }, { label: 'B', text: '157.5°', isCorrect: true }, { label: 'C', text: '180°', isCorrect: false }, { label: 'D', text: '90°', isCorrect: false }], correctAnswer: 'B', explanation: 'Minute at 270°, hour at 112.5°. Difference=157.5°.', skillTags: ['math.geometry', 'thinking.spatial'], difficulty: 'hard', estimatedTime: 65, subject: 'math' },
  { questionId: 'q-m-018', text: 'Sarah ate 3/8 of a pizza and her brother ate 2/8. How much did they eat altogether?', options: [{ label: 'A', text: '5/8', isCorrect: true }, { label: 'B', text: '5/16', isCorrect: false }, { label: 'C', text: '1/2', isCorrect: false }, { label: 'D', text: '6/8', isCorrect: false }], correctAnswer: 'A', explanation: '3/8 + 2/8 = 5/8.', skillTags: ['math.fractions'], difficulty: 'easy', estimatedTime: 30, subject: 'math' },
  { questionId: 'q-m-019', text: 'Tom has 24 marbles. He gives ⅓ to sister and ¼ of remainder to brother. How many left?', options: [{ label: 'A', text: '12', isCorrect: true }, { label: 'B', text: '8', isCorrect: false }, { label: 'C', text: '6', isCorrect: false }, { label: 'D', text: '10', isCorrect: false }], correctAnswer: 'A', explanation: '⅓ of 24=8 to sister. Remainder=16. ¼ of 16=4 to brother. Left: 12.', skillTags: ['math.word_problems', 'math.fractions'], difficulty: 'hard', estimatedTime: 70, subject: 'math' },
  { questionId: 'q-m-020', text: 'Pattern: 1, 1, 2, 3, 5, 8, 13, ?', options: [{ label: 'A', text: '18', isCorrect: false }, { label: 'B', text: '21', isCorrect: true }, { label: 'C', text: '20', isCorrect: false }, { label: 'D', text: '26', isCorrect: false }], correctAnswer: 'B', explanation: 'Fibonacci: each = sum of previous two. 8+13=21.', skillTags: ['math.number_patterns'], difficulty: 'medium', estimatedTime: 45, subject: 'math' },

  // THINKING (15 questions)
  { questionId: 'q-t-001', text: 'If you fold a square piece of paper in half diagonally and cut off the folded corner, what shape when unfolded?', options: [{ label: 'A', text: 'Triangle', isCorrect: false }, { label: 'B', text: 'Diamond (rhombus)', isCorrect: true }, { label: 'C', text: 'Circle', isCorrect: false }, { label: 'D', text: 'Rectangle', isCorrect: false }], correctAnswer: 'B', explanation: 'The cut is symmetrical across the fold line, creating a diamond shape.', skillTags: ['thinking.spatial'], difficulty: 'medium', estimatedTime: 50, subject: 'thinking' },
  { questionId: 'q-t-002', text: 'Next shape: circle, square, triangle, circle, square, ?', options: [{ label: 'A', text: 'Circle', isCorrect: false }, { label: 'B', text: 'Square', isCorrect: false }, { label: 'C', text: 'Triangle', isCorrect: true }, { label: 'D', text: 'Pentagon', isCorrect: false }], correctAnswer: 'C', explanation: 'Repeating pattern of 3: circle, square, triangle.', skillTags: ['thinking.spatial', 'thinking.logic'], difficulty: 'easy', estimatedTime: 25, subject: 'thinking' },
  { questionId: 'q-t-003', text: 'A painted cube cut into 27 smaller cubes. How many have exactly 2 red faces?', options: [{ label: 'A', text: '8', isCorrect: false }, { label: 'B', text: '12', isCorrect: true }, { label: 'C', text: '6', isCorrect: false }, { label: 'D', text: '1', isCorrect: false }], correctAnswer: 'B', explanation: 'Edge cubes (not corners) have 2 faces. 12 edges × 1 middle = 12.', skillTags: ['thinking.spatial'], difficulty: 'hard', estimatedTime: 70, subject: 'thinking' },
  { questionId: 'q-t-004', text: 'Hot is to cold as tall is to:', options: [{ label: 'A', text: 'Big', isCorrect: false }, { label: 'B', text: 'Short', isCorrect: true }, { label: 'C', text: 'Wide', isCorrect: false }, { label: 'D', text: 'Heavy', isCorrect: false }], correctAnswer: 'B', explanation: 'Antonym analogy: hot↔cold, tall↔short.', skillTags: ['thinking.analogies'], difficulty: 'easy', estimatedTime: 20, subject: 'thinking' },
  { questionId: 'q-t-005', text: 'Book is to library as painting is to:', options: [{ label: 'A', text: 'Canvas', isCorrect: false }, { label: 'B', text: 'Artist', isCorrect: false }, { label: 'C', text: 'Gallery', isCorrect: true }, { label: 'D', text: 'Brush', isCorrect: false }], correctAnswer: 'C', explanation: 'Books are in libraries, paintings are in galleries.', skillTags: ['thinking.analogies'], difficulty: 'easy', estimatedTime: 25, subject: 'thinking' },
  { questionId: 'q-t-006', text: 'Which does NOT belong: apple, banana, carrot, grape, orange?', options: [{ label: 'A', text: 'Apple', isCorrect: false }, { label: 'B', text: 'Banana', isCorrect: false }, { label: 'C', text: 'Carrot', isCorrect: true }, { label: 'D', text: 'Grape', isCorrect: false }], correctAnswer: 'C', explanation: 'Carrot is a vegetable; the rest are fruits.', skillTags: ['thinking.classification'], difficulty: 'easy', estimatedTime: 20, subject: 'thinking' },
  { questionId: 'q-t-007', text: 'All Blips are Flops. Some Flops are Zings. Which must be true?', options: [{ label: 'A', text: 'All Blips are Zings', isCorrect: false }, { label: 'B', text: 'Some Blips might be Zings', isCorrect: true }, { label: 'C', text: 'No Blips are Zings', isCorrect: false }, { label: 'D', text: 'All Zings are Blips', isCorrect: false }], correctAnswer: 'B', explanation: 'Since all Blips are Flops and some Flops are Zings, some Blips might be Zings.', skillTags: ['thinking.logic'], difficulty: 'hard', estimatedTime: 60, subject: 'thinking' },
  { questionId: 'q-t-008', text: 'Pen is to writer as scalpel is to:', options: [{ label: 'A', text: 'Kitchen', isCorrect: false }, { label: 'B', text: 'Surgeon', isCorrect: true }, { label: 'C', text: 'Knife', isCorrect: false }, { label: 'D', text: 'Hospital', isCorrect: false }], correctAnswer: 'B', explanation: 'Tool-to-user analogy: pen→writer, scalpel→surgeon.', skillTags: ['thinking.analogies'], difficulty: 'medium', estimatedTime: 30, subject: 'thinking' },
  { questionId: 'q-t-009', text: 'Complete: 2, 3, 5, 8, 13, 21, ?', options: [{ label: 'A', text: '28', isCorrect: false }, { label: 'B', text: '34', isCorrect: true }, { label: 'C', text: '32', isCorrect: false }, { label: 'D', text: '42', isCorrect: false }], correctAnswer: 'B', explanation: 'Fibonacci-like: each number is sum of two before it. 13+21=34.', skillTags: ['thinking.logic', 'math.number_patterns'], difficulty: 'medium', estimatedTime: 45, subject: 'thinking' },
  { questionId: 'q-t-010', text: 'Which does NOT belong: whisper, shout, speak, blue, murmur?', options: [{ label: 'A', text: 'whisper', isCorrect: false }, { label: 'B', text: 'shout', isCorrect: false }, { label: 'C', text: 'blue', isCorrect: true }, { label: 'D', text: 'murmur', isCorrect: false }], correctAnswer: 'C', explanation: 'The rest are ways of using your voice; blue is a colour.', skillTags: ['thinking.classification'], difficulty: 'easy', estimatedTime: 20, subject: 'thinking' },
  { questionId: 'q-t-011', text: '5 houses in a row. Red is left of green. Blue is right of yellow. Green is in the middle. What position is blue?', options: [{ label: 'A', text: 'First', isCorrect: false }, { label: 'B', text: 'Second', isCorrect: false }, { label: 'C', text: 'Fourth', isCorrect: true }, { label: 'D', text: 'Fifth', isCorrect: false }], correctAnswer: 'C', explanation: 'Green=3, red left of green. Blue right of yellow → blue=4.', skillTags: ['thinking.logic'], difficulty: 'hard', estimatedTime: 70, subject: 'thinking' },
  { questionId: 'q-t-012', text: 'If you rotate "N" 90° clockwise, it looks like:', options: [{ label: 'A', text: 'Z', isCorrect: true }, { label: 'B', text: 'M', isCorrect: false }, { label: 'C', text: 'U', isCorrect: false }, { label: 'D', text: 'S', isCorrect: false }], correctAnswer: 'A', explanation: 'N rotated 90° clockwise resembles Z.', skillTags: ['thinking.spatial'], difficulty: 'medium', estimatedTime: 40, subject: 'thinking' },
  { questionId: 'q-t-013', text: 'Today is Wednesday. What day will it be 100 days from now?', options: [{ label: 'A', text: 'Monday', isCorrect: false }, { label: 'B', text: 'Friday', isCorrect: true }, { label: 'C', text: 'Thursday', isCorrect: false }, { label: 'D', text: 'Saturday', isCorrect: false }], correctAnswer: 'B', explanation: '100÷7=14 remainder 2. Wednesday+2=Friday.', skillTags: ['thinking.logic'], difficulty: 'medium', estimatedTime: 50, subject: 'thinking' },
  { questionId: 'q-t-014', text: 'All cats are mammals. Fluffy is a cat. Therefore Fluffy is a mammal. This is:', options: [{ label: 'A', text: 'Faulty reasoning', isCorrect: false }, { label: 'B', text: 'Valid logical reasoning', isCorrect: true }, { label: 'C', text: 'An opinion', isCorrect: false }, { label: 'D', text: 'A guess', isCorrect: false }], correctAnswer: 'B', explanation: 'Valid syllogism: all A are B, C is A, therefore C is B.', skillTags: ['thinking.logic'], difficulty: 'medium', estimatedTime: 45, subject: 'thinking' },
  { questionId: 'q-t-015', text: '4 [16] 8, 3 [?] 7. What replaces ?', options: [{ label: 'A', text: '10', isCorrect: false }, { label: 'B', text: '21', isCorrect: true }, { label: 'C', text: '12', isCorrect: false }, { label: 'D', text: '24', isCorrect: false }], correctAnswer: 'B', explanation: 'Pattern: multiply the two numbers. 4×8÷2=16, 3×7=21.', skillTags: ['thinking.logic', 'math.number_patterns'], difficulty: 'hard', estimatedTime: 65, subject: 'thinking' },
];

// ── Test Sessions ───────────────────────────────────────────────

export const TEST_SESSIONS: readonly TestSession[] = [
  { sessionId: 'ts-001', studentId: 'stu-001', testId: 'test-oc-1', status: 'completed', scaledScore: 65, questionCount: 40, correctCount: 26, totalItems: 40, startedAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T10:00:00Z' },
  { sessionId: 'ts-002', studentId: 'stu-001', testId: 'test-oc-2', status: 'completed', scaledScore: 68, questionCount: 40, correctCount: 27, totalItems: 40, startedAt: '2026-02-15T09:00:00Z', completedAt: '2026-02-15T10:05:00Z' },
  { sessionId: 'ts-003', studentId: 'stu-001', testId: 'test-oc-3', status: 'completed', scaledScore: 72, questionCount: 40, correctCount: 29, totalItems: 40, startedAt: '2026-03-01T09:00:00Z', completedAt: '2026-03-01T09:55:00Z' },
  { sessionId: 'ts-004', studentId: 'stu-002', testId: 'test-oc-1', status: 'completed', scaledScore: 78, questionCount: 40, correctCount: 31, totalItems: 40, startedAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T09:50:00Z' },
  { sessionId: 'ts-005', studentId: 'stu-002', testId: 'test-oc-2', status: 'completed', scaledScore: 80, questionCount: 40, correctCount: 32, totalItems: 40, startedAt: '2026-02-15T09:00:00Z', completedAt: '2026-02-15T09:48:00Z' },
  { sessionId: 'ts-006', studentId: 'stu-002', testId: 'test-oc-3', status: 'completed', scaledScore: 85, questionCount: 40, correctCount: 34, totalItems: 40, startedAt: '2026-03-01T09:00:00Z', completedAt: '2026-03-01T09:45:00Z' },
  { sessionId: 'ts-007', studentId: 'stu-003', testId: 'test-oc-1', status: 'completed', scaledScore: 70, questionCount: 40, correctCount: 28, totalItems: 40, startedAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T10:02:00Z' },
  { sessionId: 'ts-008', studentId: 'stu-003', testId: 'test-oc-2', status: 'completed', scaledScore: 75, questionCount: 40, correctCount: 30, totalItems: 40, startedAt: '2026-02-15T09:00:00Z', completedAt: '2026-02-15T09:58:00Z' },
  { sessionId: 'ts-009', studentId: 'stu-004', testId: 'test-oc-1', status: 'completed', scaledScore: 48, questionCount: 40, correctCount: 19, totalItems: 40, startedAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T10:15:00Z' },
  { sessionId: 'ts-010', studentId: 'stu-004', testId: 'test-oc-2', status: 'completed', scaledScore: 55, questionCount: 40, correctCount: 22, totalItems: 40, startedAt: '2026-02-15T09:00:00Z', completedAt: '2026-02-15T10:10:00Z' },
  { sessionId: 'ts-011', studentId: 'stu-004', stageId: 'oc_prep', status: 'active', questionCount: 10, correctCount: 4, totalItems: 10, startedAt: '2026-03-15T14:00:00Z' },
  { sessionId: 'ts-012', studentId: 'stu-005', testId: 'test-oc-1', status: 'completed', scaledScore: 88, questionCount: 40, correctCount: 35, totalItems: 40, startedAt: '2026-02-01T09:00:00Z', completedAt: '2026-02-01T09:40:00Z' },
  { sessionId: 'ts-013', studentId: 'stu-005', testId: 'test-oc-2', status: 'completed', scaledScore: 92, questionCount: 40, correctCount: 37, totalItems: 40, startedAt: '2026-02-15T09:00:00Z', completedAt: '2026-02-15T09:38:00Z' },
];

// ── Conversation Histories ──────────────────────────────────────

export const CONVERSATION_HISTORIES: readonly ConversationHistory[] = [
  {
    sessionId: 'conv-001', actorId: 'parent-001', domain: 'parent_advisor',
    turns: [
      { role: 'user', content: 'How is Mia doing in maths lately?', timestamp: '2026-02-20T18:00:00Z' },
      { role: 'assistant', content: 'Mia has been making steady progress. Her overall mastery is at 68%, with reading as her strongest area. In maths, she does well in word problems (60%) but number patterns (45%) and geometry (50%) need attention. Her most recent test improved from 65% to 72%.', timestamp: '2026-02-20T18:00:05Z' },
      { role: 'user', content: 'What can we do to help with number patterns?', timestamp: '2026-02-20T18:01:00Z' },
      { role: 'assistant', content: 'For number patterns, I suggest: 1) Practice spotting the rule - start simple (add/subtract), then multiply/divide. 2) Use visual aids like number lines. 3) Encourage Mia to write what changes between each number. She averages 48 seconds per question, so building confidence with simpler patterns first will help.', timestamp: '2026-02-20T18:01:10Z' },
    ],
    createdAt: '2026-02-20T18:00:00Z', updatedAt: '2026-02-20T18:01:10Z',
  },
  {
    sessionId: 'conv-002', actorId: 'parent-001', domain: 'parent_advisor',
    turns: [
      { role: 'user', content: 'Mia seems to rush through the last questions. Is that showing in her results?', timestamp: '2026-03-05T19:00:00Z' },
      { role: 'assistant', content: 'Yes. Mia has a rushing indicator of 35% and declining stamina. She has about 8 fast answers, likely in the last section. I recommend practising with timed sections and short mental breaks between question groups.', timestamp: '2026-03-05T19:00:08Z' },
    ],
    createdAt: '2026-03-05T19:00:00Z', updatedAt: '2026-03-05T19:00:08Z',
  },
  {
    sessionId: 'conv-003', actorId: 'parent-002', domain: 'parent_advisor',
    turns: [
      { role: 'user', content: 'Can you tell me about Liam\'s reading progress?', timestamp: '2026-02-25T20:00:00Z' },
      { role: 'assistant', content: 'Liam performs well overall at 82% mastery, but reading has the most room for growth. Inference is at 58% and vocabulary at 55%. His maths and thinking skills are excellent, so focused reading strategies will raise his overall score.', timestamp: '2026-02-25T20:00:06Z' },
      { role: 'user', content: '他喜欢看书但是不太理解深层意思', timestamp: '2026-02-25T20:01:00Z' },
      { role: 'assistant', content: '我理解。Liam喜欢读书是很好的基础！推理能力（58%）确实需要提高。建议：1) 读完每段后用自己的话说出作者暗示的意思。2) 练习"为什么作者这样写"的问题。3) 阅读时标注关键词。他数学很强（92%），可以把更多时间分配给阅读推理。', timestamp: '2026-02-25T20:01:10Z' },
    ],
    createdAt: '2026-02-25T20:00:00Z', updatedAt: '2026-02-25T20:01:10Z',
  },
  {
    sessionId: 'conv-004', actorId: 'parent-003', domain: 'parent_advisor',
    turns: [
      { role: 'user', content: 'Oliver scored 48% on his first practice test. I\'m quite worried.', timestamp: '2026-02-10T17:00:00Z' },
      { role: 'assistant', content: 'I understand your concern. Oliver improved from 48% to 55% on his second test, which is solid progress. His strengths are spatial reasoning (72%) and logic (70%). Challenges are reading comprehension (45%) and vocabulary (38%). I recommend daily 15-minute reading sessions with comprehension questions.', timestamp: '2026-02-10T17:00:10Z' },
      { role: 'user', content: 'Is he falling too far behind to catch up?', timestamp: '2026-02-10T17:01:00Z' },
      { role: 'assistant', content: 'Oliver has shown he can improve - 48% to 55% in two weeks. His thinking skills provide a strong foundation. I suggest: 1) Daily reading practice (even 15 min). 2) Vocabulary through reading, not word lists. 3) Using his strong logical thinking to approach passages systematically. Consistent practice is what matters most.', timestamp: '2026-02-10T17:01:12Z' },
    ],
    createdAt: '2026-02-10T17:00:00Z', updatedAt: '2026-02-10T17:01:12Z',
  },
  {
    sessionId: 'conv-005', actorId: 'parent-004', domain: 'parent_advisor',
    turns: [
      { role: 'user', content: 'Sophie seems bored with practice tests. She\'s scoring 90%+. Should we do something different?', timestamp: '2026-03-10T18:30:00Z' },
      { role: 'assistant', content: 'Sophie performs exceptionally at 90% mastery! Her one development area is spatial reasoning (65%). I suggest: 1) Harder spatial reasoning questions and puzzles. 2) Timed challenges for engagement. 3) Have her explain reasoning for correct answers. 4) Extension activities like logic puzzles, Rubik\'s cubes, or origami.', timestamp: '2026-03-10T18:30:08Z' },
    ],
    createdAt: '2026-03-10T18:30:00Z', updatedAt: '2026-03-10T18:30:08Z',
  },
];

// ── Memory Records ──────────────────────────────────────────────

export const MEMORY_RECORDS: readonly MemoryRecord[] = [
  { id: 'mem-001', content: 'Parent concerned about Mia\'s math, especially number patterns. Discussed visual aids and simpler pattern practice.', namespace: '/actors/parent-001/summaries', metadata: { domain: 'parent_advisor', studentId: 'stu-001', topic: 'math' }, timestamp: '2026-02-20T18:01:10Z', actorId: 'parent-001' },
  { id: 'mem-002', content: 'Mia shows declining stamina in tests - rushes last questions. Parent interested in time management strategies.', namespace: '/actors/parent-001/summaries', metadata: { domain: 'parent_advisor', studentId: 'stu-001', topic: 'time_management' }, timestamp: '2026-03-05T19:00:08Z', actorId: 'parent-001' },
  { id: 'mem-003', content: 'Parent prefers Chinese for communication. Discussed Liam\'s reading inference challenges.', namespace: '/actors/parent-002/preferences', metadata: { domain: 'parent_advisor', studentId: 'stu-002', language: 'zh' }, timestamp: '2026-02-25T20:01:10Z', actorId: 'parent-002' },
  { id: 'mem-004', content: 'Parent worried about Oliver falling behind. Reassured with progress data (48%→55%). Focus: daily reading, vocabulary through context.', namespace: '/actors/parent-003/summaries', metadata: { domain: 'parent_advisor', studentId: 'stu-004', topic: 'progress_concern' }, timestamp: '2026-02-10T17:01:12Z', actorId: 'parent-003' },
  { id: 'mem-005', content: 'Sophie\'s parent noted boredom with standard practice. Suggested spatial reasoning focus, timed challenges, teaching as engagement.', namespace: '/actors/parent-004/summaries', metadata: { domain: 'parent_advisor', studentId: 'stu-005', topic: 'engagement' }, timestamp: '2026-03-10T18:30:08Z', actorId: 'parent-004' },
  { id: 'mem-006', content: 'Mia struggled with q-m-001 (multiply by 3 pattern). Needed 3 hints. Strategy that worked: writing operation between each pair.', namespace: '/actors/stu-001/summaries', metadata: { domain: 'student_tutor', questionId: 'q-m-001', skill: 'math.number_patterns' }, timestamp: '2026-02-22T15:00:00Z', actorId: 'stu-001' },
  { id: 'mem-007', content: 'Liam understood vocabulary question once shown context clue strategy. Can transfer math pattern skills to reading.', namespace: '/actors/stu-002/summaries', metadata: { domain: 'student_tutor', questionId: 'q-r-005', skill: 'reading.vocabulary' }, timestamp: '2026-02-23T14:30:00Z', actorId: 'stu-002' },
  { id: 'mem-008', content: 'Parent prefers brief, data-driven responses. No long motivational paragraphs.', namespace: '/actors/parent-004/preferences', metadata: { domain: 'parent_advisor' }, timestamp: '2026-03-12T10:00:00Z', actorId: 'parent-004' },
];

// ── Lookup helpers ──────────────────────────────────────────────

const studentMap = new Map(STUDENTS.map(s => [s.studentId, s]));
const questionMap = new Map(QUESTIONS.map(q => [q.questionId, q]));

export function getStudent(studentId: string): StudentData | undefined {
  return studentMap.get(studentId);
}

export function getQuestion(questionId: string): QuestionData | undefined {
  return questionMap.get(questionId);
}

export function getStudentSessions(studentId: string): readonly TestSession[] {
  return TEST_SESSIONS.filter(s => s.studentId === studentId);
}

export function getMemoriesForActor(actorId: string): readonly MemoryRecord[] {
  return MEMORY_RECORDS.filter(m => m.actorId === actorId);
}

export function searchMemories(actorId: string, query: string, maxResults = 5): readonly MemoryRecord[] {
  const actorMemories = getMemoriesForActor(actorId);
  const queryWords = query.toLowerCase().split(/\s+/);
  const scored = actorMemories.map(mem => {
    const content = mem.content.toLowerCase();
    const hits = queryWords.filter(w => content.includes(w)).length;
    return { mem, score: hits / queryWords.length };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.mem);
}

// Main export for compatibility with tool implementations
export function getTestData() {
  return {
    students: STUDENTS,
    questions: QUESTIONS,
    testSessions: TEST_SESSIONS,
    conversationHistories: CONVERSATION_HISTORIES
  };
}

export function clearTestData(): void {
  // In-memory data, no clearing needed since it's constant
}
