/**
 * Tool registry - exports all available tools for the Foundation Agent
 */

import { studentTutorTools } from './student-tools.js';
import { parentAdvisorTools } from './parent-tools.js';
import { memoryTools } from './memory-tools.js';
import { webSearchTool } from './web-search.js';

/**
 * Get all available tools
 */
export function getAllTools() {
  return [
    ...studentTutorTools,
    ...parentAdvisorTools,
    ...memoryTools,
    webSearchTool
  ];
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: 'student' | 'parent' | 'memory' | 'search' | 'all') {
  switch (category) {
    case 'student':
      return studentTutorTools;
    case 'parent':
      return parentAdvisorTools;
    case 'memory':
      return memoryTools;
    case 'search':
      return [webSearchTool];
    case 'all':
    default:
      return getAllTools();
  }
}

/**
 * Get tool by name
 */
export function getToolByName(name: string) {
  const allTools = getAllTools();
  return allTools.find(tool => tool.name === name);
}