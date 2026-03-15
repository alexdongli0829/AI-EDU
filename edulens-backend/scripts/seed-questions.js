/**
 * Seed Questions for All Stages
 * Populates questions for: oc_prep, selective, hsc, lifelong
 * Subjects per stage: math, general_ability, english, (+writing for selective)
 * 2 questions per skill × 6 skills per subject = 12 per subject/stage combo
 *
 * Usage: node seed-questions.js [--dry-run]
 */

const API_BASE = process.env.NEXT_PUBLIC_TEST_API || 'https://npwg8my4w5.execute-api.us-west-2.amazonaws.com/dev';
const API_KEY  = process.env.ADMIN_API_KEY       || '4ufbnf9yed7pNhTasnVpK64zCVgqACQp6AqMdQkI';
const DRY_RUN  = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function q(text, options, correctAnswer, skillTags, subject, stageId, difficulty = 0.4, gradeLevel = null) {
  return {
    text,
    type: 'multiple_choice',
    options: options.map((t, i) => ({ id: ['A','B','C','D'][i], text: t, isCorrect: t === correctAnswer })),
    correctAnswer,
    difficulty,
    estimatedTime: 60,
    skillTags,
    subject,
    gradeLevel,
    stageId,
    isActive: true,
  };
}

const G = { oc_prep: 5, selective: 6, hsc: 11, lifelong: 12 };

// ---------------------------------------------------------------------------
// OC_PREP — Year 5/6 (grade 5)
// ---------------------------------------------------------------------------
const OC_MATH = [
  // Number & Algebra
  q('What is the value of 3 × (4 + 5) − 6?', ['15','21','27','33'], '21', ['Number & Algebra'], 'math', 'oc_prep', 0.3, 5),
  q('If n + 7 = 15, what is the value of n?', ['6','7','8','22'], '8', ['Number & Algebra'], 'math', 'oc_prep', 0.25, 5),
  // Fractions & Decimals
  q('What is 3/4 + 1/8?', ['4/12','3/8','7/8','1'], '7/8', ['Fractions & Decimals'], 'math', 'oc_prep', 0.35, 5),
  q('Convert 0.625 to a fraction in simplest form.', ['3/4','5/8','6/10','62/100'], '5/8', ['Fractions & Decimals'], 'math', 'oc_prep', 0.45, 5),
  // Measurement & Geometry
  q('A rectangle has length 12 cm and width 5 cm. What is its area?', ['34 cm²','60 cm²','17 cm²','120 cm²'], '60 cm²', ['Measurement & Geometry'], 'math', 'oc_prep', 0.3, 5),
  q('What is the sum of interior angles in a triangle?', ['90°','180°','270°','360°'], '180°', ['Measurement & Geometry'], 'math', 'oc_prep', 0.2, 5),
  // Statistics & Probability
  q('A bag has 3 red and 5 blue marbles. What is the probability of picking a red marble?', ['3/5','3/8','5/8','1/3'], '3/8', ['Statistics & Probability'], 'math', 'oc_prep', 0.35, 5),
  q('The scores of 5 students are 8, 6, 9, 7, 5. What is the mean score?', ['6','7','8','35'], '7', ['Statistics & Probability'], 'math', 'oc_prep', 0.3, 5),
  // Problem Solving
  q('Sarah has 3 times as many stickers as Tom. Together they have 48. How many does Sarah have?', ['12','24','36','16'], '36', ['Problem Solving'], 'math', 'oc_prep', 0.45, 5),
  q('A train travels 240 km in 3 hours. How far in 5 hours at the same speed?', ['300 km','360 km','400 km','480 km'], '400 km', ['Problem Solving'], 'math', 'oc_prep', 0.4, 5),
  // Working Mathematically
  q('What is the next number in the sequence: 2, 5, 11, 23, ___?', ['35','44','46','47'], '47', ['Working Mathematically'], 'math', 'oc_prep', 0.5, 5),
  q('How many ways can you make 30 cents using only 5-cent and 10-cent coins?', ['2','3','4','5'], '4', ['Working Mathematically'], 'math', 'oc_prep', 0.55, 5),
];

const OC_GA = [
  // Logical Reasoning
  q('All dogs are animals. Rex is a dog. Therefore Rex is ___.',
    ['not an animal','an animal','a plant','possibly an animal'], 'an animal', ['Logical Reasoning'], 'general_ability', 'oc_prep', 0.3, 5),
  q('You must be 16 to vote. Jake is 14. Therefore Jake ___.',
    ['can vote','cannot vote','might vote','is old enough'], 'cannot vote', ['Logical Reasoning'], 'general_ability', 'oc_prep', 0.25, 5),
  // Pattern Recognition
  q('What comes next: 1, 4, 9, 16, ___?', ['20','24','25','36'], '25', ['Pattern Recognition'], 'general_ability', 'oc_prep', 0.3, 5),
  q('What letter comes next: A, C, E, G, ___?', ['H','I','J','K'], 'I', ['Pattern Recognition'], 'general_ability', 'oc_prep', 0.25, 5),
  // Spatial Reasoning
  q('How many faces does a cube have?', ['4','6','8','12'], '6', ['Spatial Reasoning'], 'general_ability', 'oc_prep', 0.2, 5),
  q('A rectangle is folded in half lengthways. How many layers thick is the result?', ['1','2','4','8'], '2', ['Spatial Reasoning'], 'general_ability', 'oc_prep', 0.3, 5),
  // Verbal Reasoning
  q('Cold is to hot as night is to ___.', ['dark','moon','day','sleep'], 'day', ['Verbal Reasoning'], 'general_ability', 'oc_prep', 0.25, 5),
  q('Which word is most similar in meaning to "enormous"?', ['tiny','huge','average','noisy'], 'huge', ['Verbal Reasoning'], 'general_ability', 'oc_prep', 0.2, 5),
  // Abstract Reasoning
  q('Which figure does NOT belong: circle, oval, rectangle, sphere?', ['circle','oval','rectangle','sphere'], 'sphere', ['Abstract Reasoning'], 'general_ability', 'oc_prep', 0.4, 5),
  q('In a set of shapes, three are 2D and one is 3D. Which is the odd one out: square, triangle, cylinder, pentagon?', ['square','triangle','cylinder','pentagon'], 'cylinder', ['Abstract Reasoning'], 'general_ability', 'oc_prep', 0.35, 5),
  // Critical Thinking
  q('A student scored 85% on a test. Which conclusion is most reasonable?', ['All students got 85%','The test was easy','The student passed','Most students failed'], 'The student passed', ['Critical Thinking'], 'general_ability', 'oc_prep', 0.4, 5),
  q('A company claims "9 out of 10 dentists recommend our toothpaste." What is most important to know?', ['The price of the toothpaste','How many dentists were surveyed','The flavour options','The company profits'], 'How many dentists were surveyed', ['Critical Thinking'], 'general_ability', 'oc_prep', 0.5, 5),
];

const OC_ENG = [
  // Reading Comprehension
  q('A passage describes a boy who plants seeds in spring and harvests vegetables in autumn. What is the main idea?', ['Spring is the best season','Farming requires patience and planning','Boys enjoy gardening','Seeds grow into vegetables'], 'Farming requires patience and planning', ['Reading Comprehension'], 'english', 'oc_prep', 0.35, 5),
  q('"The library was quiet except for the soft rustling of pages." What is the setting?', ['A classroom','A bookshop','A library','A home'], 'A library', ['Reading Comprehension'], 'english', 'oc_prep', 0.2, 5),
  // Vocabulary
  q('Which word best replaces "happy" to show extreme joy?', ['pleased','fine','ecstatic','content'], 'ecstatic', ['Vocabulary'], 'english', 'oc_prep', 0.35, 5),
  q('The word "benevolent" means most nearly ___.', ['cruel','intelligent','kind-hearted','powerful'], 'kind-hearted', ['Vocabulary'], 'english', 'oc_prep', 0.4, 5),
  // Inference & Interpretation
  q('"Maria grabbed an umbrella before leaving the house." What can you infer?', ['Maria is going shopping','It might rain','Maria is in a hurry','Maria lost her jacket'], 'It might rain', ['Inference & Interpretation'], 'english', 'oc_prep', 0.3, 5),
  q('A character keeps checking her watch and tapping her fingers. What is she likely feeling?', ['Happy','Bored','Impatient','Curious'], 'Impatient', ['Inference & Interpretation'], 'english', 'oc_prep', 0.3, 5),
  // Grammar & Language
  q('Which sentence uses correct punctuation?', ["Let's go to the park.","Lets go to the park.","Let's go, to the park.","Lets' go to the park."], "Let's go to the park.", ['Grammar & Language'], 'english', 'oc_prep', 0.3, 5),
  q('Choose the correct verb: "The team ___ practicing every day."', ['is','are','be','were'], 'is', ['Grammar & Language'], 'english', 'oc_prep', 0.3, 5),
  // Text Structure
  q('Which text type would you use to persuade someone to recycle more?', ['A narrative story','A persuasive essay','A recipe','A diary entry'], 'A persuasive essay', ['Text Structure'], 'english', 'oc_prep', 0.25, 5),
  q('What is the purpose of the introduction in an essay?', ['To summarise all main points','To present evidence','To introduce the topic and main argument','To end the discussion'], 'To introduce the topic and main argument', ['Text Structure'], 'english', 'oc_prep', 0.3, 5),
  // Language & Expression
  q('What literary device is used in: "The stars danced in the night sky"?', ['Simile','Personification','Alliteration','Rhyme'], 'Personification', ['Language & Expression'], 'english', 'oc_prep', 0.35, 5),
  q('Which sentence contains a simile?', ['The wind howled all night.','She ran like the wind.','Time flies.','The classroom was a zoo.'], 'She ran like the wind.', ['Language & Expression'], 'english', 'oc_prep', 0.3, 5),
];

// ---------------------------------------------------------------------------
// SELECTIVE — Year 6/7 (grade 6)
// ---------------------------------------------------------------------------
const SEL_MATH = [
  // Number & Algebra
  q('Simplify: 4x + 3 − 2x + 7.', ['2x + 10','6x + 10','2x + 4','6x + 4'], '2x + 10', ['Number & Algebra'], 'math', 'selective', 0.4, 6),
  q('What is the highest common factor of 36 and 48?', ['6','9','12','18'], '12', ['Number & Algebra'], 'math', 'selective', 0.4, 6),
  // Measurement & Space
  q('A circle has radius 7 cm. What is its circumference? (Use π ≈ 22/7)', ['22 cm','44 cm','154 cm','308 cm'], '44 cm', ['Measurement & Space'], 'math', 'selective', 0.45, 6),
  q('A triangle has base 10 cm and height 6 cm. What is its area?', ['16 cm²','30 cm²','60 cm²','300 cm²'], '30 cm²', ['Measurement & Space'], 'math', 'selective', 0.35, 6),
  // Statistics & Probability
  q('Two fair coins are tossed. What is the probability of getting two heads?', ['1/4','1/2','3/4','1/8'], '1/4', ['Statistics & Probability'], 'math', 'selective', 0.4, 6),
  q('In a data set 3, 7, 7, 9, 11, 13, the median is ___.',['7','8','9','11'], '8', ['Statistics & Probability'], 'math', 'selective', 0.45, 6),
  // Working Mathematically
  q('A sequence follows the rule: multiply by 2 then add 1. Starting at 3, what is the 4th term?', ['25','27','31','53'], '31', ['Working Mathematically'], 'math', 'selective', 0.5, 6),
  q('Explain why 0.9 recurring equals 1. Which reason is correct?', ['It is close to 1 but not equal','1 − 0.9 recurring = 0, so they are equal','Rounding makes it 1','Calculators say so'], '1 − 0.9 recurring = 0, so they are equal', ['Working Mathematically'], 'math', 'selective', 0.6, 6),
  // Problem Solving
  q('A tap fills a 120-litre tank at 8 litres per minute. Another drains it at 3 litres per minute. How many minutes to fill from empty?', ['15','20','24','40'], '24', ['Problem Solving'], 'math', 'selective', 0.55, 6),
  q('A jacket costs $80 after a 20% discount. What was the original price?', ['$96','$100','$104','$160'], '$100', ['Problem Solving'], 'math', 'selective', 0.5, 6),
  // Financial Maths
  q('$500 is invested at 4% simple interest per year. What is the interest earned after 3 years?', ['$20','$40','$60','$80'], '$60', ['Financial Maths'], 'math', 'selective', 0.45, 6),
  q('An item costs $45 plus 10% GST. What is the total cost?', ['$49','$49.50','$54','$55'], '$49.50', ['Financial Maths'], 'math', 'selective', 0.4, 6),
];

const SEL_GA = [
  // Abstract Reasoning
  q('In a 3×3 grid, each row contains a circle, square, and triangle. Each column also contains each shape once. The bottom-right cell is missing. What goes there?', ['Circle','Square','Triangle','Diamond'], 'Circle', ['Abstract Reasoning'], 'general_ability', 'selective', 0.5, 6),
  q('Which shape continues the pattern: each row increases the number of sides by one, starting with 3. Row 3 is:', ['Pentagon','Hexagon','Octagon','Triangle'], 'Pentagon', ['Abstract Reasoning'], 'general_ability', 'selective', 0.45, 6),
  // Logical Deduction
  q('All A are B. Some B are C. Therefore:', ['All A are C','Some A might be C','No A are C','All C are A'], 'Some A might be C', ['Logical Deduction'], 'general_ability', 'selective', 0.55, 6),
  q('If it is raining, the ground is wet. The ground is wet. Therefore:', ['It is raining','It might be raining','It is not raining','The sky is cloudy'], 'It might be raining', ['Logical Deduction'], 'general_ability', 'selective', 0.6, 6),
  // Pattern Recognition
  q('What is the next term: 3, 6, 12, 24, ___?', ['36','42','48','56'], '48', ['Pattern Recognition'], 'general_ability', 'selective', 0.35, 6),
  q('What is the next pair: AB, DE, GH, ___?', ['IJ','JK','KL','MN'], 'JK', ['Pattern Recognition'], 'general_ability', 'selective', 0.5, 6),
  // Spatial Reasoning
  q('A net is folded into a 3D shape. Which shape can be made from a net with one square and four triangles?', ['Cube','Cone','Square-based pyramid','Rectangular prism'], 'Square-based pyramid', ['Spatial Reasoning'], 'general_ability', 'selective', 0.5, 6),
  q('A shape is reflected across a vertical axis. If the original points right, the reflection points:', ['Right','Left','Up','Down'], 'Left', ['Spatial Reasoning'], 'general_ability', 'selective', 0.4, 6),
  // Verbal Reasoning
  q('Book is to library as painting is to ___.',['Author','Canvas','Gallery','Museum'], 'Gallery', ['Verbal Reasoning'], 'general_ability', 'selective', 0.4, 6),
  q('Which word is the odd one out: oak, pine, maple, rose, elm?', ['oak','pine','maple','rose'], 'rose', ['Verbal Reasoning'], 'general_ability', 'selective', 0.3, 6),
  // Critical Analysis
  q('"Brand X tastes better according to 70% of people surveyed." Which weakens this claim most?', ['Brand X is cheaper','Only 10 people were surveyed','Brand X has been around for 50 years','It comes in many flavours'], 'Only 10 people were surveyed', ['Critical Analysis'], 'general_ability', 'selective', 0.5, 6),
  q('A study shows students who eat breakfast perform better at school. What is the most valid conclusion?', ['Breakfast causes better performance','There is an association between breakfast and performance','All students who eat breakfast get high grades','Not eating breakfast ruins your brain'], 'There is an association between breakfast and performance', ['Critical Analysis'], 'general_ability', 'selective', 0.55, 6),
];

const SEL_ENG = [
  // Reading Comprehension
  q('A passage about climate change explains causes and effects, then proposes solutions. What is the overall purpose?', ['To entertain readers','To inform and persuade about climate action','To describe the history of science','To tell a personal story'], 'To inform and persuade about climate action', ['Reading Comprehension'], 'english', 'selective', 0.4, 6),
  q('In a passage, the author uses statistics and expert quotes to support a claim. This is an example of:', ['Creative writing','Narrative techniques','Evidence-based argumentation','Personal opinion'], 'Evidence-based argumentation', ['Reading Comprehension'], 'english', 'selective', 0.45, 6),
  // Inference & Interpretation
  q('"She put down her pen and stared out the window for a long time." What can be inferred?', ['She finished her work','She is deep in thought or distracted','She is looking at the weather','She lost her pen'], 'She is deep in thought or distracted', ['Inference & Interpretation'], 'english', 'selective', 0.45, 6),
  q('A poem ends with "the candle flickered and died." This most likely symbolises:', ['A power outage','The end of hope or life','The end of winter','An empty room'], 'The end of hope or life', ['Inference & Interpretation'], 'english', 'selective', 0.5, 6),
  // Vocabulary in Context
  q('In the sentence "The arid desert stretched endlessly," the word "arid" means:', ['cold and icy','vast and open','extremely dry','rocky and rough'], 'extremely dry', ['Vocabulary in Context'], 'english', 'selective', 0.35, 6),
  q('The word "ambiguous" means:', ['unclear or having two possible meanings','absolutely certain','very large','rarely used'], 'unclear or having two possible meanings', ['Vocabulary in Context'], 'english', 'selective', 0.45, 6),
  // Text Analysis
  q('What is the structural purpose of a topic sentence in a paragraph?', ['To provide a conclusion','To introduce evidence','To state the main idea of the paragraph','To create suspense'], 'To state the main idea of the paragraph', ['Text Analysis'], 'english', 'selective', 0.35, 6),
  q('A non-fiction text uses subheadings, bullet points, and diagrams. This suggests it is:', ['A novel','A poem','An informational report','A personal letter'], 'An informational report', ['Text Analysis'], 'english', 'selective', 0.3, 6),
  // Literary Techniques
  q('"The thunder groaned like a wounded animal." This is an example of:', ['Personification','Simile','Metaphor','Alliteration'], 'Simile', ['Literary Techniques'], 'english', 'selective', 0.4, 6),
  q('Repetition of the same consonant sound at the start of nearby words is called:', ['Assonance','Rhyme','Alliteration','Onomatopoeia'], 'Alliteration', ['Literary Techniques'], 'english', 'selective', 0.3, 6),
  // Author's Purpose
  q('An author includes a scene showing a character being bullied at school before becoming successful. What is the likely purpose?', ['To show bullying is fine','To create tension for tension\'s sake','To show adversity can motivate growth','To describe school life accurately'], "To show adversity can motivate growth", ["Author's Purpose"], 'english', 'selective', 0.5, 6),
  q('The author repeats the phrase "we can do better" three times at the end of a speech. The main purpose is to:', ['confuse the reader','add rhyme','emphasise and create impact','describe a new idea'], 'emphasise and create impact', ["Author's Purpose"], 'english', 'selective', 0.45, 6),
];

const SEL_WRITING = [
  // Ideas & Content
  q('Which technique best develops an idea in a persuasive essay?', ['Using vague general statements','Providing specific evidence and examples','Repeating the same point','Using very long sentences'], 'Providing specific evidence and examples', ['Ideas & Content'], 'writing', 'selective', 0.4, 6),
  q('To make creative writing more engaging, a writer should:', ['Use the same sentence length throughout','Begin each sentence with "I"','Include vivid sensory details','Avoid dialogue'], 'Include vivid sensory details', ['Ideas & Content'], 'writing', 'selective', 0.35, 6),
  // Text Structure
  q('In a well-structured persuasive essay, the body paragraphs should:', ['Each introduce a new topic','Begin with evidence before the claim','Begin with a clear topic sentence followed by evidence','All say the same thing'], 'Begin with a clear topic sentence followed by evidence', ['Text Structure'], 'writing', 'selective', 0.4, 6),
  q('What is the purpose of a conclusion in an essay?', ['To introduce new arguments','To restate and synthesise the key points','To list all the evidence again','To begin a new topic'], 'To restate and synthesise the key points', ['Text Structure'], 'writing', 'selective', 0.35, 6),
  // Language Features
  q('Which use of language is most appropriate in a formal essay?', ['"This is totally wrong and super unfair"','"The policy is demonstrably inequitable"','"Like, nobody agrees with this"','"I reckon it\'s a bad idea"'], '"The policy is demonstrably inequitable"', ['Language Features'], 'writing', 'selective', 0.4, 6),
  q('A writer uses the phrase "countless lives shattered." This is an example of:', ['Understatement','Hyperbole and emotive language','Scientific language','Neutral reporting'], 'Hyperbole and emotive language', ['Language Features'], 'writing', 'selective', 0.45, 6),
  // Grammar & Punctuation
  q('Which sentence is correctly punctuated?', ['However, the results were unexpected.','However the results were unexpected.','However; the results were unexpected.','However the results, were unexpected.'], 'However, the results were unexpected.', ['Grammar & Punctuation'], 'writing', 'selective', 0.4, 6),
  q('Choose the correctly written sentence:', ['The team have gave their best effort.','The team had given their best effort.','The team has gave their best effort.','The team given their best effort.'], 'The team had given their best effort.', ['Grammar & Punctuation'], 'writing', 'selective', 0.35, 6),
  // Vocabulary
  q('Which word best conveys "very happy" in formal writing?', ['Super happy','Elated','Really glad','Over the moon'], 'Elated', ['Vocabulary'], 'writing', 'selective', 0.3, 6),
  q('Replace the vague word "said" with the most precise option for an angry speaker:', ['stated','murmured','snapped','replied'], 'snapped', ['Vocabulary'], 'writing', 'selective', 0.3, 6),
  // Writing for Audience
  q('A student is writing a letter to the school principal requesting new sports equipment. The tone should be:', ['Informal and casual','Formal and respectful','Emotional and dramatic','Humorous and light'], 'Formal and respectful', ['Writing for Audience'], 'writing', 'selective', 0.3, 6),
  q('A narrative aimed at young children should:', ['Use complex vocabulary and long sentences','Use simple language and relatable characters','Focus on abstract philosophical themes','Include technical terminology'], 'Use simple language and relatable characters', ['Writing for Audience'], 'writing', 'selective', 0.25, 6),
];

// ---------------------------------------------------------------------------
// HSC — Year 11/12 (grade 11)
// ---------------------------------------------------------------------------
const HSC_MATH = [
  // Functions & Graphs
  q('What is the range of f(x) = x² + 1?', ['All real numbers','y ≥ 0','y ≥ 1','y > 1'], 'y ≥ 1', ['Functions & Graphs'], 'math', 'hsc', 0.5, 11),
  q('Which function has a vertical asymptote at x = 3?', ['f(x) = 1/(x+3)','f(x) = 1/(x−3)','f(x) = x − 3','f(x) = (x−3)²'], 'f(x) = 1/(x−3)', ['Functions & Graphs'], 'math', 'hsc', 0.5, 11),
  // Calculus
  q('What is the derivative of f(x) = 3x² − 5x + 2?', ['6x − 5','3x − 5','6x² − 5','6x + 2'], '6x − 5', ['Calculus'], 'math', 'hsc', 0.5, 11),
  q('∫(2x + 3) dx = ?', ['x² + 3x + C','2x² + 3x + C','x² + 3 + C','2 + C'], 'x² + 3x + C', ['Calculus'], 'math', 'hsc', 0.5, 11),
  // Financial Maths
  q('$10,000 is invested at 5% per annum compound interest. What is the value after 2 years?', ['$11,000','$11,025','$11,250','$12,500'], '$11,025', ['Financial Maths'], 'math', 'hsc', 0.45, 11),
  q('A loan of $20,000 at 6% p.a. simple interest is repaid after 3 years. Total interest paid?', ['$1,200','$2,400','$3,600','$6,000'], '$3,600', ['Financial Maths'], 'math', 'hsc', 0.4, 11),
  // Statistics & Data
  q('In a normal distribution, approximately what percentage of data falls within 1 standard deviation of the mean?', ['50%','68%','75%','95%'], '68%', ['Statistics & Data'], 'math', 'hsc', 0.5, 11),
  q('A scatter plot shows a strong negative correlation. This means:', ['As x increases, y increases','As x increases, y decreases','x and y are unrelated','y causes x to change'], 'As x increases, y decreases', ['Statistics & Data'], 'math', 'hsc', 0.45, 11),
  // Algebra & Equations
  q('Solve: 2x² − 8 = 0.', ['x = ±2','x = ±4','x = 2','x = 4'], 'x = ±2', ['Algebra & Equations'], 'math', 'hsc', 0.5, 11),
  q('Solve simultaneously: x + y = 10, x − y = 4.', ['x=7, y=3','x=8, y=2','x=6, y=4','x=3, y=7'], 'x=7, y=3', ['Algebra & Equations'], 'math', 'hsc', 0.5, 11),
  // Measurement & Geometry
  q('Using the cosine rule, find side c if a=5, b=7, C=60°.', ['c=√39','c=√51','c=√29','c=6'], 'c=√39', ['Measurement & Geometry'], 'math', 'hsc', 0.6, 11),
  q('The surface area of a sphere with radius 3 is:', ['12π','36π','72π','108π'], '36π', ['Measurement & Geometry'], 'math', 'hsc', 0.5, 11),
];

const HSC_GA = [
  // Scientific Reasoning
  q('A scientist repeats an experiment 10 times to reduce the effect of random error. This improves:', ['Accuracy','Validity','Precision/reliability','Efficiency'], 'Precision/reliability', ['Scientific Reasoning'], 'general_ability', 'hsc', 0.5, 11),
  q('A hypothesis must be:', ['True','Testable and falsifiable','Supported by all existing evidence','Proven by one experiment'], 'Testable and falsifiable', ['Scientific Reasoning'], 'general_ability', 'hsc', 0.45, 11),
  // Data Analysis
  q('A line of best fit on a scatter plot is used to:', ['Connect all data points','Predict values within the data range','Show the median','List all outliers'], 'Predict values within the data range', ['Data Analysis'], 'general_ability', 'hsc', 0.45, 11),
  q('In a bar graph showing temperature by month, the tallest bar represents:', ['The hottest month','The coldest month','The rainiest month','The month with highest humidity'], 'The hottest month', ['Data Analysis'], 'general_ability', 'hsc', 0.3, 11),
  // Experiment Design
  q('In an experiment testing if fertiliser affects plant growth, the independent variable is:', ['Plant height','The amount of water','The type/amount of fertiliser','The type of soil'], 'The type/amount of fertiliser', ['Experiment Design'], 'general_ability', 'hsc', 0.5, 11),
  q('A control group in an experiment is:', ['The group that receives the most treatment','The group with no treatment, used for comparison','The group with the best results','The largest group'], 'The group with no treatment, used for comparison', ['Experiment Design'], 'general_ability', 'hsc', 0.4, 11),
  // Chemical Concepts
  q('In the reaction H₂ + Cl₂ → 2HCl, the products are:', ['Hydrogen and chlorine','Hydrochloric acid','Hydrogen chloride molecules only','Water and salt'], 'Hydrogen chloride molecules only', ['Chemical Concepts'], 'general_ability', 'hsc', 0.5, 11),
  q('An element with atomic number 6 has how many protons?', ['3','6','12','8'], '6', ['Chemical Concepts'], 'general_ability', 'hsc', 0.35, 11),
  // Physical Concepts
  q("Newton's second law states that Force equals:", ['mass divided by acceleration','mass multiplied by acceleration','acceleration divided by mass','mass plus velocity'], 'mass multiplied by acceleration', ['Physical Concepts'], 'general_ability', 'hsc', 0.4, 11),
  q('A wave with frequency 5 Hz and wavelength 4 m has a speed of:', ['0.8 m/s','9 m/s','1.25 m/s','20 m/s'], '20 m/s', ['Physical Concepts'], 'general_ability', 'hsc', 0.5, 11),
  // Biological Concepts
  q('Mitosis produces cells that are:', ['Haploid and genetically unique','Diploid and genetically identical to the parent','Haploid and identical','Diploid and genetically unique'], 'Diploid and genetically identical to the parent', ['Biological Concepts'], 'general_ability', 'hsc', 0.5, 11),
  q('The role of DNA in a cell is to:', ['Produce energy','Store and transmit genetic information','Break down food molecules','Transport oxygen'], 'Store and transmit genetic information', ['Biological Concepts'], 'general_ability', 'hsc', 0.4, 11),
];

const HSC_ENG = [
  // Textual Analysis
  q('Close reading of a text involves:', ['Summarising the plot','Analysing specific language choices and their effects','Reading as quickly as possible','Identifying the author'], 'Analysing specific language choices and their effects', ['Textual Analysis'], 'english', 'hsc', 0.45, 11),
  q('When analysing a text, which question is most useful?', ['How long is the text?','Who is the author?','What techniques does the author use and to what effect?','When was it written?'], 'What techniques does the author use and to what effect?', ['Textual Analysis'], 'english', 'hsc', 0.4, 11),
  // Essay Writing
  q('A strong thesis statement in an essay should:', ['Be a question','Summarise the plot','Present a debatable interpretive claim about the text','List the techniques used'], 'Present a debatable interpretive claim about the text', ['Essay Writing'], 'english', 'hsc', 0.5, 11),
  q('The PEEL structure in body paragraphs stands for:', ['Point, Evidence, Explain, Link','Point, Example, Evaluate, Last','Paragraph, Essay, Evidence, List','Purpose, Elaborate, Examine, Language'], 'Point, Evidence, Explain, Link', ['Essay Writing'], 'english', 'hsc', 0.4, 11),
  // Creative Writing
  q('Which technique most effectively establishes character voice in a short story?', ['Telling the reader directly what the character is like','Using distinctive dialogue and internal thoughts','Describing the setting in detail','Summarising the character\'s history'], 'Using distinctive dialogue and internal thoughts', ['Creative Writing'], 'english', 'hsc', 0.5, 11),
  q('In medias res means a narrative:', ['Begins at the beginning','Starts in the middle of the action','Ends with a twist','Is told in first person'], 'Starts in the middle of the action', ['Creative Writing'], 'english', 'hsc', 0.45, 11),
  // Vocabulary & Language
  q('The connotation of a word refers to:', ['Its dictionary definition','The emotional or cultural associations of the word','How many syllables it has','Whether it is a noun or verb'], 'The emotional or cultural associations of the word', ['Vocabulary & Language'], 'english', 'hsc', 0.45, 11),
  q('Using elevated register in an essay means:', ['Writing in a casual, conversational tone','Using formal, sophisticated vocabulary appropriate to academic writing','Avoiding punctuation','Writing shorter sentences'], 'Using formal, sophisticated vocabulary appropriate to academic writing', ['Vocabulary & Language'], 'english', 'hsc', 0.4, 11),
  // Literary Techniques
  q('Dramatic irony occurs when:', ['The character and audience both know the same information','The audience knows something the character does not','Both characters are confused','The ending is surprising'], 'The audience knows something the character does not', ['Literary Techniques'], 'english', 'hsc', 0.5, 11),
  q('A symbol in literature is:', ['A punctuation mark','An object or image that represents a deeper meaning','A type of rhyme scheme','A genre of poetry'], 'An object or image that represents a deeper meaning', ['Literary Techniques'], 'english', 'hsc', 0.45, 11),
  // Text & Context
  q('How does historical context affect our reading of a text?', ['It makes the text harder to read','It has no effect on meaning','It shapes the values, language, and themes the composer drew on','It only matters for non-fiction'], 'It shapes the values, language, and themes the composer drew on', ['Text & Context'], 'english', 'hsc', 0.5, 11),
  q('A text composed during World War II would most likely reflect:', ['Themes of digital technology','Themes of conflict, sacrifice, and national identity','Themes of environmental sustainability','Contemporary gender politics'], 'Themes of conflict, sacrifice, and national identity', ['Text & Context'], 'english', 'hsc', 0.45, 11),
];

// ---------------------------------------------------------------------------
// LIFELONG — Adult learners (grade 12+)
// ---------------------------------------------------------------------------
const LL_MATH = [
  // Statistical Analysis
  q('A p-value of 0.03 in a hypothesis test (significance level 0.05) means:', ['The null hypothesis is true','The null hypothesis is rejected','The result is not significant','The sample size is too small'], 'The null hypothesis is rejected', ['Statistical Analysis'], 'math', 'lifelong', 0.6, 12),
  q('A 95% confidence interval means:', ['The data is 95% accurate','There is a 95% chance the interval contains the true population parameter','The sample size is 95','The result is 95% correct'], 'There is a 95% chance the interval contains the true population parameter', ['Statistical Analysis'], 'math', 'lifelong', 0.65, 12),
  // Mathematical Modelling
  q('In exponential growth modelled by P = P₀·eᵏᵗ, what does k represent?', ['Initial population','Time elapsed','The growth rate constant','Euler\'s number'], 'The growth rate constant', ['Mathematical Modelling'], 'math', 'lifelong', 0.6, 12),
  q('A linear model y = 2x + 5 predicts that when x = 10, y = ?', ['15','20','25','30'], '25', ['Mathematical Modelling'], 'math', 'lifelong', 0.4, 12),
  // Logical Reasoning
  q('If P → Q and ¬Q, then by modus tollens:', ['P is true','Q is true','P is false','Nothing can be concluded'], 'P is false', ['Logical Reasoning'], 'math', 'lifelong', 0.6, 12),
  q('A valid deductive argument is one where:', ['The conclusion is always true','If the premises are true, the conclusion must be true','The premises are always true','The argument uses many examples'], 'If the premises are true, the conclusion must be true', ['Logical Reasoning'], 'math', 'lifelong', 0.55, 12),
  // Financial Literacy
  q('Compound interest grows faster than simple interest because:', ['The interest rate is higher','Interest is calculated on the original principal only','Interest is calculated on the principal plus accumulated interest','Banks charge fees'], 'Interest is calculated on the principal plus accumulated interest', ['Financial Literacy'], 'math', 'lifelong', 0.5, 12),
  q('Diversifying an investment portfolio primarily helps to:', ['Maximise returns','Eliminate all risk','Reduce risk by spreading investments','Increase liquidity'], 'Reduce risk by spreading investments', ['Financial Literacy'], 'math', 'lifelong', 0.5, 12),
  // Data Interpretation
  q('A time-series graph showing sales data has an upward trend with seasonal dips each July. The most likely explanation is:', ['Data error','Sales are always low in July due to seasonal patterns','The company is losing customers','Prices rise in July'], 'Sales are always low in July due to seasonal patterns', ['Data Interpretation'], 'math', 'lifelong', 0.55, 12),
  q('Two datasets have the same mean but different standard deviations. The one with the higher standard deviation has:', ['Higher average values','More spread/variability in data','Fewer data points','More outliers only'], 'More spread/variability in data', ['Data Interpretation'], 'math', 'lifelong', 0.55, 12),
  // Quantitative Analysis
  q('To calculate the percentage change from 80 to 100:', ['(100 − 80)/100 × 100 = 20%','(100 − 80)/80 × 100 = 25%','(80 − 100)/80 × 100 = −25%','80/100 × 100 = 80%'], '(100 − 80)/80 × 100 = 25%', ['Quantitative Analysis'], 'math', 'lifelong', 0.5, 12),
  q('An index number of 115 (base year = 100) indicates prices have:', ['Fallen by 15%','Stayed the same','Risen by 15%','Risen by 115%'], 'Risen by 15%', ['Quantitative Analysis'], 'math', 'lifelong', 0.5, 12),
];

const LL_GA = [
  // Argumentation
  q('The main contention of an argument is:', ['A piece of evidence','The central claim the argument aims to establish','A counterargument','An example'], 'The central claim the argument aims to establish', ['Argumentation'], 'general_ability', 'lifelong', 0.45, 12),
  q('A sound argument must be:', ['Valid and have true premises','Long and detailed','Supported by statistics','Written formally'], 'Valid and have true premises', ['Argumentation'], 'general_ability', 'lifelong', 0.55, 12),
  // Evidence Evaluation
  q('A peer-reviewed journal article is considered reliable because:', ['It is freely available online','It has been evaluated by independent experts in the field','It is written by professors','It uses lots of data'], 'It has been evaluated by independent experts in the field', ['Evidence Evaluation'], 'general_ability', 'lifelong', 0.5, 12),
  q('Anecdotal evidence is weak because:', ['It is too recent','It is based on individual experience, not systematic data','It comes from newspapers','It uses emotional language'], 'It is based on individual experience, not systematic data', ['Evidence Evaluation'], 'general_ability', 'lifelong', 0.5, 12),
  // Logical Fallacies
  q('"You should support this policy because everyone else does." This is an example of:', ['Ad hominem','Appeal to authority','Bandwagon fallacy','False dichotomy'], 'Bandwagon fallacy', ['Logical Fallacies'], 'general_ability', 'lifelong', 0.5, 12),
  q('"Either you are with us or against us." This is an example of:', ['Straw man','False dichotomy','Red herring','Circular reasoning'], 'False dichotomy', ['Logical Fallacies'], 'general_ability', 'lifelong', 0.5, 12),
  // Analytical Reasoning
  q('Systems thinking involves:', ['Optimising individual components in isolation','Understanding how components interact within a whole system','Focusing only on short-term outcomes','Ignoring feedback loops'], 'Understanding how components interact within a whole system', ['Analytical Reasoning'], 'general_ability', 'lifelong', 0.55, 12),
  q('Root cause analysis is used to:', ['Describe symptoms of a problem','Identify the deepest underlying cause of a problem','List all possible solutions','Measure outcomes'], 'Identify the deepest underlying cause of a problem', ['Analytical Reasoning'], 'general_ability', 'lifelong', 0.5, 12),
  // Synthesis & Inference
  q('Synthesis in academic research means:', ['Summarising one source','Combining insights from multiple sources to form a new understanding','Copying sources accurately','Listing all sources used'], 'Combining insights from multiple sources to form a new understanding', ['Synthesis & Inference'], 'general_ability', 'lifelong', 0.55, 12),
  q('An inference is:', ['A fact stated directly in the text','A conclusion drawn from evidence and reasoning','A quotation from a source','A definition'], 'A conclusion drawn from evidence and reasoning', ['Synthesis & Inference'], 'general_ability', 'lifelong', 0.45, 12),
  // Problem Framing
  q('Reframing a problem means:', ['Ignoring the original problem','Changing your perspective to see the problem differently','Solving the problem faster','Adding more resources'], 'Changing your perspective to see the problem differently', ['Problem Framing'], 'general_ability', 'lifelong', 0.5, 12),
  q('Defining the scope of a problem is important because:', ['It makes the problem seem smaller','It focuses effort on what is within reach to solve','It eliminates the need for evidence','It speeds up decision-making automatically'], 'It focuses effort on what is within reach to solve', ['Problem Framing'], 'general_ability', 'lifelong', 0.5, 12),
];

const LL_ENG = [
  // Academic Reading
  q('The abstract of a journal article tells you:', ['The full conclusions of the study','A brief overview of purpose, methods, and findings','The biographies of the authors','All the references used'], 'A brief overview of purpose, methods, and findings', ['Academic Reading'], 'english', 'lifelong', 0.45, 12),
  q('Skimming a text means:', ['Reading every word carefully','Quickly looking for key information and main ideas','Re-reading multiple times','Reading aloud'], 'Quickly looking for key information and main ideas', ['Academic Reading'], 'english', 'lifelong', 0.35, 12),
  // Academic Writing
  q('APA referencing style requires which information first in a reference list entry?', ['Year of publication','Title of the work','Author\'s last name','Publisher name'], "Author's last name", ['Academic Writing'], 'english', 'lifelong', 0.5, 12),
  q('Paraphrasing a source means:', ['Copying the text word for word','Translating it to another language','Expressing the idea in your own words while citing the source','Shortening the quote'], 'Expressing the idea in your own words while citing the source', ['Academic Writing'], 'english', 'lifelong', 0.45, 12),
  // Rhetorical Analysis
  q('Ethos in rhetoric refers to:', ['An appeal to logic and evidence','An appeal to emotion','An appeal to the speaker\'s credibility or character','An appeal to the audience\'s self-interest'], "An appeal to the speaker's credibility or character", ['Rhetorical Analysis'], 'english', 'lifelong', 0.5, 12),
  q('Pathos in an argument is most evident when:', ['Statistics are used','The speaker\'s credentials are highlighted','Emotional stories or language are used to move the audience','A logical structure is followed'], 'Emotional stories or language are used to move the audience', ['Rhetorical Analysis'], 'english', 'lifelong', 0.45, 12),
  // Vocabulary & Register
  q('Academic register is characterised by:', ['Casual contractions and slang','Precise, formal vocabulary and objective tone','First-person storytelling','Short bullet-point sentences'], 'Precise, formal vocabulary and objective tone', ['Vocabulary & Register'], 'english', 'lifelong', 0.45, 12),
  q('Which term best describes the vocabulary appropriate to a specific field of study?', ['Slang','Colloquial language','Discipline-specific terminology','Plain language'], 'Discipline-specific terminology', ['Vocabulary & Register'], 'english', 'lifelong', 0.45, 12),
  // Text Critique
  q('A critical evaluation of a text should:', ['Accept all claims made by the author','Identify strengths, limitations, and assumptions','Only focus on what is wrong','Summarise the text only'], 'Identify strengths, limitations, and assumptions', ['Text Critique'], 'english', 'lifelong', 0.5, 12),
  q('Positionality in research means:', ['The physical location of the researcher','The researcher\'s social position and perspective that may influence interpretation','The order of research steps','The position of data in a table'], "The researcher's social position and perspective that may influence interpretation", ['Text Critique'], 'english', 'lifelong', 0.55, 12),
  // Communication
  q('Coherence in writing refers to:', ['Using lots of vocabulary','The logical flow and connection of ideas throughout the text','Having long paragraphs','Using passive voice'], 'The logical flow and connection of ideas throughout the text', ['Communication'], 'english', 'lifelong', 0.45, 12),
  q('Active listening involves:', ['Waiting for your turn to speak','Judging the speaker as they talk','Fully concentrating, understanding, and responding thoughtfully','Nodding without processing what is said'], 'Fully concentrating, understanding, and responding thoughtfully', ['Communication'], 'english', 'lifelong', 0.4, 12),
];

// ---------------------------------------------------------------------------
// All questions
// ---------------------------------------------------------------------------
const ALL_QUESTIONS = [
  ...OC_MATH, ...OC_GA, ...OC_ENG,
  ...SEL_MATH, ...SEL_GA, ...SEL_ENG, ...SEL_WRITING,
  ...HSC_MATH, ...HSC_GA, ...HSC_ENG,
  ...LL_MATH, ...LL_GA, ...LL_ENG,
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function seedQuestions() {
  console.log(`\nEduLens Seed Questions`);
  console.log(`API: ${API_BASE}`);
  console.log(`Total questions: ${ALL_QUESTIONS.length}`);

  const byStage = {};
  for (const q of ALL_QUESTIONS) {
    byStage[q.stageId] = (byStage[q.stageId] || 0) + 1;
  }
  console.log('By stage:', byStage);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no questions will be sent.');
    return;
  }

  // Send in batches of 50
  const BATCH = 50;
  let imported = 0;

  for (let i = 0; i < ALL_QUESTIONS.length; i += BATCH) {
    const batch = ALL_QUESTIONS.slice(i, i + BATCH);
    console.log(`\nSending batch ${Math.floor(i/BATCH)+1} (questions ${i+1}–${i+batch.length})...`);

    const res = await fetch(`${API_BASE}/admin/bulk/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ format: 'json', data: batch }),
    });

    const json = await res.json();
    if (json.success) {
      console.log(`  OK — imported ${json.data?.imported} questions`);
      imported += json.data?.imported || 0;
    } else {
      console.error(`  FAILED:`, JSON.stringify(json.error));
      process.exit(1);
    }
  }

  console.log(`\nDone. Total imported: ${imported} questions.`);
}

// ---------------------------------------------------------------------------
// Verify analytics after seeding
// ---------------------------------------------------------------------------
async function verifyAnalytics(studentId) {
  if (!studentId) return;
  console.log('\nVerifying analytics...');
  for (const stageId of ['oc_prep', 'selective', 'hsc', 'lifelong']) {
    const url = `${API_BASE}/analytics/student/${studentId}?stageId=${stageId}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      const a = json.analytics;
      console.log(`  [${stageId}] totalTests=${a.totalTests} avgScore=${a.averageScore}`);
    } else {
      console.log(`  [${stageId}] (no sessions yet — analytics empty)`);
    }
  }
}

seedQuestions()
  .then(() => verifyAnalytics(process.env.TEST_STUDENT_ID))
  .catch(err => { console.error(err); process.exit(1); });
