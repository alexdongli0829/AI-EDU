"""Shared tool: memory retrieval (mock version).
In production, replace with real AgentCore Memory SDK calls."""

import json

from strands import tool

from .mock_data import MOCK_MEMORY_RECORDS


@tool
def retrieve_memories(query: str, namespace: str = "", max_results: int = 5) -> str:
    """Search past conversation memories for relevant context. Returns long-term memory records matching the query.

    Args:
        query: Search query for memory retrieval.
        namespace: Optional namespace filter (e.g. 'parent-conversations', 'tutoring-sessions').
        max_results: Max results to return (default 5).
    """
    query_lower = query.lower()
    words = query_lower.split()

    scored = []
    for record in MOCK_MEMORY_RECORDS:
        if namespace and record["namespace"] != namespace:
            continue
        content_lower = record["content"].lower()
        match_count = sum(1 for w in words if w in content_lower)
        score = match_count / len(words) if words else 0
        if score > 0:
            scored.append({
                "content": record["content"],
                "relevance": f"{score:.2f}",
                "namespace": record["namespace"],
            })

    scored.sort(key=lambda x: float(x["relevance"]), reverse=True)

    return json.dumps({
        "query": query,
        "resultCount": len(scored[:max_results]),
        "records": scored[:max_results],
    }, indent=2)
