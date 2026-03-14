"""
AWS Bedrock Client

Wrapper around AWS Bedrock Runtime API for invoking Claude models.
Provides non-streaming invocation for background job processing.
"""

import json
import logging
from typing import Dict, List, Optional, Any
import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)


class BedrockMessage:
    """Message structure for Bedrock requests"""

    def __init__(self, role: str, content: str):
        self.role = role  # 'user' or 'assistant'
        self.content = content

    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}


class BedrockClient:
    """AWS Bedrock client for Claude models"""

    # Bedrock model IDs
    MODEL_IDS = {
        "sonnet": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "haiku": "anthropic.claude-3-5-haiku-20241022-v1:0",
    }

    def __init__(self, region: Optional[str] = None):
        """
        Initialize Bedrock client

        Args:
            region: AWS region (defaults to environment AWS_REGION or us-east-1)
        """
        import os

        self.region = region or os.environ.get("AWS_REGION", "us-east-1")

        # Configure boto3 with retries
        config = Config(
            region_name=self.region,
            retries={"max_attempts": 3, "mode": "adaptive"},
        )

        self.client = boto3.client("bedrock-runtime", config=config)
        logger.info(f"BedrockClient initialized with region: {self.region}")

    def invoke_message(
        self,
        messages: List[BedrockMessage],
        system_prompt: str,
        model: str = "haiku",
        max_tokens: int = 4096,
        temperature: float = 1.0,
        top_p: float = 0.999,
    ) -> str:
        """
        Invoke Claude model (non-streaming)

        Args:
            messages: List of conversation messages
            system_prompt: System prompt for Claude
            model: Model to use ('sonnet' or 'haiku')
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 - 1.0)
            top_p: Nucleus sampling parameter

        Returns:
            Generated text response

        Raises:
            Exception: If Bedrock invocation fails
        """
        model_id = self.MODEL_IDS.get(model)
        if not model_id:
            raise ValueError(f"Invalid model: {model}. Use 'sonnet' or 'haiku'")

        # Format request body for Claude
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "system": system_prompt,
            "messages": [msg.to_dict() for msg in messages],
        }

        logger.info(
            f"Bedrock invoke request",
            extra={
                "model_id": model_id,
                "message_count": len(messages),
                "system_prompt_length": len(system_prompt),
            },
        )

        try:
            response = self.client.invoke_model(
                modelId=model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body),
            )

            # Parse response
            response_body = json.loads(response["body"].read())

            # Extract text from Claude response
            text = response_body.get("content", [{}])[0].get("text", "")

            if not text:
                raise ValueError("No text in Bedrock response")

            logger.info(
                f"Bedrock invoke complete",
                extra={
                    "model_id": model_id,
                    "response_length": len(text),
                    "input_tokens": response_body.get("usage", {}).get(
                        "input_tokens", 0
                    ),
                    "output_tokens": response_body.get("usage", {}).get(
                        "output_tokens", 0
                    ),
                },
            )

            return text

        except Exception as e:
            logger.error(
                f"Bedrock invoke error: {str(e)}",
                extra={"model_id": model_id},
                exc_info=True,
            )
            raise

    def invoke_with_json_response(
        self,
        messages: List[BedrockMessage],
        system_prompt: str,
        model: str = "haiku",
        max_tokens: int = 4096,
    ) -> Dict[str, Any]:
        """
        Invoke Claude and parse JSON response

        Useful for structured data extraction (summarization, insights)

        Args:
            messages: List of conversation messages
            system_prompt: System prompt (should request JSON output)
            model: Model to use ('sonnet' or 'haiku')
            max_tokens: Maximum tokens to generate

        Returns:
            Parsed JSON response as dictionary

        Raises:
            json.JSONDecodeError: If response is not valid JSON
        """
        # Add JSON instruction to system prompt if not present
        if "json" not in system_prompt.lower():
            system_prompt += (
                "\n\nIMPORTANT: Return your response as valid JSON only, "
                "with no additional text or markdown formatting."
            )

        response_text = self.invoke_message(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=0.0,  # Lower temperature for structured output
        )

        # Try to parse JSON
        try:
            # Remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse JSON response: {str(e)}",
                extra={"response_text": response_text[:500]},
            )
            raise

    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count (rough approximation)

        More accurate: use tokenization service or count via API

        Args:
            text: Text to estimate

        Returns:
            Estimated token count
        """
        # Rough estimate: 1 token ≈ 4 characters for English text
        return len(text) // 4

    def validate_token_budget(
        self,
        system_prompt: str,
        messages: List[BedrockMessage],
        max_budget: int,
    ) -> bool:
        """
        Validate token budget before making request

        Args:
            system_prompt: System prompt
            messages: List of messages
            max_budget: Maximum allowed tokens

        Returns:
            True if within budget, False otherwise
        """
        system_tokens = self.estimate_tokens(system_prompt)
        message_tokens = sum(self.estimate_tokens(msg.content) for msg in messages)
        total_tokens = system_tokens + message_tokens

        logger.info(
            f"Token budget validation",
            extra={
                "system_tokens": system_tokens,
                "message_tokens": message_tokens,
                "total_tokens": total_tokens,
                "max_budget": max_budget,
                "within_budget": total_tokens <= max_budget,
            },
        )

        return total_tokens <= max_budget


# Singleton instance
_bedrock_client: Optional[BedrockClient] = None


def get_bedrock_client() -> BedrockClient:
    """Get or create singleton Bedrock client"""
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = BedrockClient()
    return _bedrock_client
