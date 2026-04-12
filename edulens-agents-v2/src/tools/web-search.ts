/**
 * Web Search Tool - Brave Search API integration for real-time web information
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import axios from 'axios';
import { BraveSearchSchema, BraveSearchResult } from '../shared/types.js';

// Extended schema with additional parameters
const WebSearchSchema = BraveSearchSchema.extend({
  count: z.number().int().min(1).max(20).optional().default(5).describe('Number of search results to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Pagination offset'),
  freshness: z.enum(['pd', 'pw', 'pm', 'py', 'any']).optional().describe('Freshness filter: past day, week, month, year, or any'),
  text_decorations: z.boolean().optional().default(false).describe('Include text formatting in results'),
  spellcheck: z.boolean().optional().default(true).describe('Enable spell correction')
});

interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      date_last_crawled?: string;
      language?: string;
      profile?: {
        name?: string;
      };
      thumbnail?: {
        src?: string;
      };
    }>;
    family_friendly: boolean;
  };
  news?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
      language?: string;
    }>;
  };
}

/**
 * Perform web search using Brave Search API
 */
async function webSearch(input: z.infer<typeof WebSearchSchema>): Promise<string> {
  const { query, country, safesearch, count, offset, freshness, text_decorations, spellcheck } = input;

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('Brave Search API key not configured. Set BRAVE_SEARCH_API_KEY environment variable.');
  }

  try {
    // Validate query for educational context
    const educationalQuery = validateAndEnhanceQuery(query);

    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      params: {
        q: educationalQuery,
        country: country || 'AU',
        safesearch: safesearch || 'strict',
        count: count || 5,
        offset,
        freshness,
        text_decorations,
        spellcheck,
        result_filter: 'web,news', // Focus on web and news results
        summary: 1 // Request AI-generated summary when available
      },
      timeout: 10000 // 10 second timeout
    });

    const searchData: BraveSearchResponse = response.data;

    // Process and filter results
    const results = processSearchResults(searchData, query);

    // Prepare response
    const searchResult = {
      query: educationalQuery,
      originalQuery: query,
      totalResults: results.length,
      country,
      safesearch,
      results: results.slice(0, count),
      metadata: {
        searchTime: new Date().toISOString(),
        apiProvider: 'brave',
        educationalContext: true,
        familyFriendly: searchData.web?.family_friendly || true
      },
      summary: generateSearchSummary(results, query)
    };

    return JSON.stringify(searchResult, null, 2);

  } catch (error) {
    console.error('Web search error:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        throw new Error('Search API rate limit exceeded. Please try again later.');
      } else if (status === 401) {
        throw new Error('Invalid Brave Search API key.');
      } else if (status && status >= 500) {
        throw new Error('Search service temporarily unavailable. Please try again later.');
      }
    }

    // Return error response rather than throwing
    const errorResult = {
      query,
      error: true,
      message: 'Search temporarily unavailable',
      results: [],
      fallback: generateFallbackResponse(query)
    };

    return JSON.stringify(errorResult, null, 2);
  }
}

/**
 * Validate and enhance query for educational context
 */
function validateAndEnhanceQuery(query: string): string {
  // Remove potential injection attempts
  const cleanQuery = query
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim();

  if (cleanQuery.length < 2) {
    throw new Error('Search query too short. Please provide a more specific query.');
  }

  if (cleanQuery.length > 400) {
    throw new Error('Search query too long. Please shorten your query.');
  }

  // Enhance with educational context for NSW OC/Selective preparation
  const educationalKeywords = [
    'nsw oc', 'selective school', 'primary school', 'year 5', 'year 6',
    'australia education', 'gifted talented'
  ];

  const needsContext = !educationalKeywords.some(keyword =>
    cleanQuery.toLowerCase().includes(keyword.toLowerCase())
  );

  // Add educational context if the query seems relevant
  if (needsContext && isEducationalQuery(cleanQuery)) {
    return `${cleanQuery} NSW Australia education`;
  }

  return cleanQuery;
}

/**
 * Check if query is educational in nature
 */
function isEducationalQuery(query: string): boolean {
  const educationalIndicators = [
    'exam', 'test', 'practice', 'preparation', 'study', 'learning',
    'math', 'mathematics', 'reading', 'comprehension', 'thinking skills',
    'pattern', 'logic', 'reasoning', 'vocabulary', 'grammar',
    'school', 'grade', 'level', 'curriculum', 'education',
    'tutor', 'teaching', 'homework', 'assignment'
  ];

  const lowerQuery = query.toLowerCase();
  return educationalIndicators.some(indicator =>
    lowerQuery.includes(indicator)
  );
}

/**
 * Process and filter search results
 */
function processSearchResults(data: BraveSearchResponse, originalQuery: string): BraveSearchResult[] {
  const results: BraveSearchResult[] = [];

  // Process web results
  if (data.web?.results) {
    for (const result of data.web.results) {
      // Filter out inappropriate or non-educational sites
      if (isAppropriateResult(result, originalQuery)) {
        results.push({
          title: cleanText(result.title),
          url: result.url,
          description: cleanText(result.description),
          age: result.date_last_crawled ? formatAge(result.date_last_crawled) : undefined,
          language: result.language
        });
      }
    }
  }

  // Process news results if relevant
  if (data.news?.results) {
    for (const result of data.news.results) {
      if (isAppropriateResult(result, originalQuery)) {
        results.push({
          title: cleanText(result.title),
          url: result.url,
          description: cleanText(result.description),
          age: result.age,
          language: result.language
        });
      }
    }
  }

  return results;
}

/**
 * Check if search result is appropriate for educational context
 */
function isAppropriateResult(result: any, query: string): boolean {
  const url = result.url.toLowerCase();
  const title = result.title.toLowerCase();
  const description = result.description.toLowerCase();

  // Blocked domains
  const blockedDomains = [
    'reddit.com', 'twitter.com', 'facebook.com', 'instagram.com',
    'tiktok.com', 'youtube.com/watch', // Allow main YouTube but not specific videos
    'pinterest.com', 'tumblr.com'
  ];

  if (blockedDomains.some(domain => url.includes(domain))) {
    return false;
  }

  // Preferred educational domains
  const educationalDomains = [
    'edu.au', 'nsw.gov.au', 'education.nsw.gov.au',
    'wikipedia.org', 'britannica.com', 'nationalgeographic.com',
    'khanacademy.org', 'mathsisfun.com', 'coolmath.com'
  ];

  // Strongly prefer educational domains
  if (educationalDomains.some(domain => url.includes(domain))) {
    return true;
  }

  // Check for inappropriate content indicators
  const inappropriateIndicators = [
    'dating', 'adult', 'gambling', 'casino', 'betting',
    'violent', 'weapon', 'drug', 'alcohol'
  ];

  const content = `${title} ${description}`;
  if (inappropriateIndicators.some(indicator => content.includes(indicator))) {
    return false;
  }

  return true;
}

/**
 * Clean text content
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Format age/date information
 */
function formatAge(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return 'Recently';
  }
}

/**
 * Generate search summary
 */
function generateSearchSummary(results: BraveSearchResult[], query: string): string {
  if (results.length === 0) {
    return `No relevant results found for "${query}". Try rephrasing your search or using different keywords.`;
  }

  const topResult = results[0];
  return `Found ${results.length} results for "${query}". Most relevant: ${topResult?.title} - ${topResult?.description?.substring(0, 100)}...`;
}

/**
 * Generate fallback response when search fails
 */
function generateFallbackResponse(query: string): string {
  return `I couldn't search for "${query}" right now due to a technical issue. For NSW OC and Selective School information, I recommend checking the official NSW Department of Education website (education.nsw.gov.au) or asking me about specific topics I can help with from my knowledge.`;
}

// Tool definition using Strands SDK
export const webSearchTool = tool({
  name: 'web_search',
  description: 'Search the web for current information about NSW OC/Selective School preparation, education policies, exam dates, and related educational content. Use when you need up-to-date information not in your training data.',
  inputSchema: WebSearchSchema,
  callback: webSearch
});