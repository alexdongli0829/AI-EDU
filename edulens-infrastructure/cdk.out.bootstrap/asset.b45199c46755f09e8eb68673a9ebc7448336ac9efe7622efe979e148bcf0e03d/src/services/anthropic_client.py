"""
Anthropic Claude API client for summarization
Uses Claude Haiku for fast, cost-effective summarization
"""

import os
import json
from typing import Dict, Any, Optional
from anthropic import Anthropic


class AnthropicClient:
    """
    Client for Claude API focused on summarization tasks
    Uses Claude Haiku (fast and cheap) by default
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Anthropic client

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=self.api_key)
        self.default_model = "claude-haiku-4.5-20251001"

    def generate_summary(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.3
    ) -> str:
        """
        Generate a summary using Claude Haiku

        Args:
            system_prompt: System instructions
            user_prompt: User content to summarize
            max_tokens: Maximum response tokens
            temperature: Response randomness (0.0-1.0)

        Returns:
            Generated summary text
        """
        try:
            response = self.client.messages.create(
                model=self.default_model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )

            # Extract text from response
            if response.content and len(response.content) > 0:
                return response.content[0].text
            else:
                raise ValueError("Empty response from Claude API")

        except Exception as e:
            print(f"Error calling Claude API: {str(e)}")
            raise

    def extract_structured_data(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """
        Extract structured data using Claude Haiku

        Expects JSON response from Claude

        Args:
            system_prompt: System instructions (should request JSON)
            user_prompt: User content to analyze
            max_tokens: Maximum response tokens
            temperature: Response randomness

        Returns:
            Parsed JSON dictionary
        """
        try:
            response = self.client.messages.create(
                model=self.default_model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )

            # Extract and parse JSON
            if response.content and len(response.content) > 0:
                text = response.content[0].text

                # Try to parse as JSON
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    # If not valid JSON, try to extract JSON from markdown code block
                    if "```json" in text:
                        json_start = text.find("```json") + 7
                        json_end = text.find("```", json_start)
                        json_text = text[json_start:json_end].strip()
                        return json.loads(json_text)
                    elif "```" in text:
                        json_start = text.find("```") + 3
                        json_end = text.find("```", json_start)
                        json_text = text[json_start:json_end].strip()
                        return json.loads(json_text)
                    else:
                        raise ValueError(f"Could not parse JSON from response: {text}")
            else:
                raise ValueError("Empty response from Claude API")

        except Exception as e:
            print(f"Error extracting structured data: {str(e)}")
            raise

    def batch_summarize(
        self,
        items: list[Dict[str, str]],
        system_prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.3
    ) -> list[str]:
        """
        Batch summarize multiple items

        Args:
            items: List of dicts with 'content' key
            system_prompt: System instructions
            max_tokens: Maximum tokens per summary
            temperature: Response randomness

        Returns:
            List of summaries (same order as input)
        """
        summaries = []

        for item in items:
            try:
                summary = self.generate_summary(
                    system_prompt=system_prompt,
                    user_prompt=item["content"],
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                summaries.append(summary)
            except Exception as e:
                print(f"Error summarizing item: {str(e)}")
                summaries.append("")

        return summaries
