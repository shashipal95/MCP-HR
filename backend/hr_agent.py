"""
HR Agent
========
Uses an Ollama LLM with a ReAct-style loop to decide which MCP tool to call,
executes it via the MCP client, and synthesises a final answer.

Supports both:
  - ask()        → returns complete answer string
  - ask_stream() → async generator yielding tokens for streaming
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys
from typing import Any, AsyncIterator

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

log = logging.getLogger("hr_agent")

# ── LLM (Ollama) ─────────────────────────────────────────────────────────────
try:
    from langchain_ollama import OllamaLLM
    _llm = OllamaLLM(model="llama3.2:3b", temperature=0, num_predict=512)
    LLM_AVAILABLE = True
except Exception:
    LLM_AVAILABLE = False
    log.warning("Ollama not available – agent will use direct tool calls only.")

# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are an intelligent HR Assistant with access to a set of tools.

## Available Tools
{tool_docs}

## Rules
- If you need a tool, respond with ONLY valid JSON (no markdown, no extra text):
    {{"tool": "tool_name", "args": {{...}}}}
- Integer parameters like "k" or "limit" MUST be numbers, not strings: "k": 5 not "k": "5"
- Employee names may be in "Last, First" format — always pass the FULL name as one string.
  Example: {{"tool": "get_employee_details", "args": {{"name": "Clayton, Rick"}}}}
- After receiving tool results, write your final answer in plain English.
- Do NOT call another tool if you already have the information needed.
- Be concise, professional, and privacy-aware.

## Conversation History
{history}
"""

SYNTHESIS_PROMPT = """\
Answer ONLY the specific question asked. Do not volunteer extra information.

Question: {question}

Employee Data:
{tool_results}

Rules:
1. Answer ONLY what was asked. If asked for age, give only the age. If asked for pay rate, give only the pay rate.
2. For yes/no questions: answer "Yes" or "No" first, then one short sentence.
   - "Single" or "Unmarried" means NOT married → answer is "No".
   - "Active" employment means NOT terminated → answer is "No, not terminated".
3. For a single field (age, salary, department, position): give ONE direct sentence.
   Example - Q: "age of Clayton, Rick" → "Clayton, Rick is 32 years old."
   Example - Q: "pay rate of Clayton, Rick" → "Clayton, Rick's pay rate is $28.99/hr."
4. Do NOT list other employee attributes. Do NOT answer questions that were not asked.
5. Do NOT output JSON.
Answer:"""


# ─────────────────────────────────────────────────────────────────────────────
class MCPClient:
    def __init__(self, server_script: str = "mcp_hr_server.py"):
        self.server_script = server_script
        self._session: ClientSession | None = None
        self._tools: dict[str, Any] = {}

    async def connect(self):
        params = StdioServerParameters(command=sys.executable, args=[self.server_script])
        self._cm = stdio_client(params)
        read, write = await self._cm.__aenter__()
        self._session = ClientSession(read, write)
        await self._session.__aenter__()
        await self._session.initialize()
        tools_resp = await self._session.list_tools()
        self._tools = {t.name: t for t in tools_resp.tools}
        log.info("Connected to MCP server. Tools: %s", list(self._tools))

    async def call(self, tool_name: str, args: dict) -> str:
        if self._session is None:
            raise RuntimeError("MCPClient not connected.")
        args = _sanitize_args(tool_name, args, self._tools)
        resp = await self._session.call_tool(tool_name, args)
        return "\n".join(
            block.text for block in resp.content if hasattr(block, "text")
        )

    def tool_docs(self) -> str:
        lines = []
        for name, tool in self._tools.items():
            schema = tool.inputSchema or {}
            props = schema.get("properties", {})
            param_str = ", ".join(
                f"{k}: {v.get('type','any')} — {v.get('description','')}"
                for k, v in props.items()
            )
            lines.append(f"### {name}\n{tool.description}\nParameters: {param_str or 'none'}\n")
        return "\n".join(lines)

    async def disconnect(self):
        if self._session:
            await self._session.__aexit__(None, None, None)
        if hasattr(self, "_cm"):
            await self._cm.__aexit__(None, None, None)


# ─────────────────────────────────────────────────────────────────────────────
def _sanitize_args(tool_name: str, args: dict, tools: dict) -> dict:
    tool = tools.get(tool_name)
    if not tool:
        return args
    schema_props = (tool.inputSchema or {}).get("properties", {})
    sanitized = {}
    for k, v in args.items():
        expected_type = schema_props.get(k, {}).get("type", "")
        if expected_type == "integer" and isinstance(v, str):
            try:
                sanitized[k] = int(v)
            except ValueError:
                sanitized[k] = v
        elif expected_type == "number" and isinstance(v, str):
            try:
                sanitized[k] = float(v)
            except ValueError:
                sanitized[k] = v
        else:
            sanitized[k] = v
    return sanitized


def _parse_tool_call(text: str) -> dict | None:
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch != "{":
            continue
        try:
            obj, _ = decoder.raw_decode(text, i)
            if isinstance(obj, dict) and "tool" in obj:
                return obj
        except json.JSONDecodeError:
            continue
    return None


def _extract_employee_name(question: str) -> str | None:
    patterns = [
        r"(?:of|for)\s+([A-Z][a-zA-Z]+,\s*[A-Z][a-zA-Z]+)",
        r"(?:of|for)\s+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)",
        r"\b([A-Z][a-zA-Z]+,\s*[A-Z][a-zA-Z]+)\b",
    ]
    for pat in patterns:
        m = re.search(pat, question)
        if m:
            return m.group(1).strip()
    return None


# ─────────────────────────────────────────────────────────────────────────────
MAX_TOOL_CALLS = 3


def _run_llm_sync(prompt: str) -> str:
    """Run LLM synchronously (used inside tool-call phase)."""
    return _llm.invoke(prompt).strip()


async def _run_llm_async(prompt: str) -> str:
    """Run blocking LLM call in a thread so we don't block the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_llm_sync, prompt)


async def _stream_llm(prompt: str) -> AsyncIterator[str]:
    """
    Stream tokens from Ollama using langchain's .stream() method.
    Runs the blocking iterator in a thread pool to avoid blocking the event loop.
    """
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def _produce():
        try:
            for chunk in _llm.stream(prompt):
                # chunk is a string token from langchain-ollama
                loop.call_soon_threadsafe(queue.put_nowait, chunk)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, f"\n[Stream error: {exc}]")
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    # Start producer in thread pool
    loop.run_in_executor(None, _produce)

    while True:
        token = await queue.get()
        if token is None:
            break
        yield token


# ─────────────────────────────────────────────────────────────────────────────
class HRAgent:
    def __init__(self, client: MCPClient, user_id: str = "anonymous"):
        self.client = client
        self.user_id = user_id

    # ── Internal: run tool-calling loop, return (collected_results, early_answer)
    async def _run_tool_loop(self, question: str, chat_history: list[dict]):
        """
        Phase 1: Call tools until we have enough data OR the LLM gives a direct answer.
        Returns (collected_results: list[str], early_answer: str | None)
        """
        if not LLM_AVAILABLE:
            result = await self._keyword_fallback(question)
            return [], result  # return as early answer

        direct = await self._try_direct_route_data(question)
        if direct is not None:
            # direct is (tool_results_list, early_answer_or_None)
            return direct

        history_text = "\n".join(
            f"User: {h['user']}\nAssistant: {h['bot']}" for h in chat_history[-6:]
        )
        system = SYSTEM_PROMPT.format(
            tool_docs=self.client.tool_docs(),
            history=history_text or "(none)",
        )
        conversation = f"{system}\n\nUser: {question}\nAssistant:"
        collected_results: list[str] = []

        for _ in range(MAX_TOOL_CALLS):
            raw = await _run_llm_async(conversation)
            log.debug("LLM tool phase: %s", raw[:200])

            tool_call = _parse_tool_call(raw)

            if tool_call is None:
                if raw.strip():
                    return [], raw  # LLM gave direct answer — early exit
                break

            tool_name = tool_call.get("tool", "")
            args = tool_call.get("args", {})
            if not tool_name:
                if raw.strip():
                    return [], raw
                break

            if tool_name in ("get_employee_details", "search_employees"):
                try:
                    await self.client.call("log_audit_event", {
                        "tool": tool_name, "query": question,
                        "user_id": self.user_id, "status": "ok",
                    })
                except Exception:
                    pass

            try:
                result = await self.client.call(tool_name, args)
            except Exception as exc:
                result = f"Tool error: {exc}"

            collected_results.append(f"[{tool_name}]\n{result}")
            conversation = (
                f"{conversation}\n{raw}\n"
                f"[Tool Result for {tool_name}]\n{result}\n"
                f"Assistant:"
            )

        return collected_results, None  # no early answer — need synthesis

    # ── Public: non-streaming ask ─────────────────────────────────────────────
    async def ask(self, question: str, chat_history: list[dict]) -> str:
        collected_results, early_answer = await self._run_tool_loop(question, chat_history)

        if early_answer is not None:
            return early_answer

        if not collected_results:
            return "I was unable to find relevant information. Please try rephrasing."

        synthesis_prompt = SYNTHESIS_PROMPT.format(
            question=question,
            tool_results="\n\n".join(collected_results),
        )
        answer = await _run_llm_async(synthesis_prompt)

        if _parse_tool_call(answer) is not None:
            clean = [l for l in answer.splitlines() if not l.strip().startswith("{")]
            answer = " ".join(clean).strip()
            if not answer:
                answer = "Here is the data retrieved:\n\n" + "\n\n".join(collected_results)
        return answer

    # ── Public: streaming ask ─────────────────────────────────────────────────
    async def ask_stream(self, question: str, chat_history: list[dict]) -> AsyncIterator[str]:
        """
        Async generator that:
          1. Runs tool calls silently (non-streamed — these are fast internal ops)
          2. Yields a status event so the UI can show "Querying database..."
          3. Streams the final LLM synthesis token by token
        """
        # ── Tool phase (silent) ───────────────────────────────────────────────
        collected_results, early_answer = await self._run_tool_loop(question, chat_history)

        # ── Early answer: stream it token-by-token too ────────────────────────
        if early_answer is not None:
            # The tool loop returned a pre-formed answer — stream it character
            # by character so the UI still gets the streaming effect
            for char in early_answer:
                yield char
                await asyncio.sleep(0)  # yield control to event loop
            return

        if not collected_results:
            yield "I was unable to find relevant information. Please try rephrasing."
            return

        # ── Signal that tools completed (frontend can dismiss spinner) ────────
        # We use a special SSE event type "status" for this
        yield "\x00TOOLS_DONE\x00"  # sentinel consumed by api_server, not shown to user

        # ── Stream synthesis ──────────────────────────────────────────────────
        synthesis_prompt = SYNTHESIS_PROMPT.format(
            question=question,
            tool_results="\n\n".join(collected_results),
        )

        accumulated = ""
        async for token in _stream_llm(synthesis_prompt):
            accumulated += token
            yield token

        # Post-process: if LLM still emitted JSON, strip it (non-streaming cleanup)
        # Nothing to do here since we already streamed — the UI will show what came out.
        # For production you'd buffer and validate, but for local Ollama this is fine.

    # ── Direct routing helpers ────────────────────────────────────────────────
    async def _try_direct_route_data(self, question: str):
        """
        Returns (collected_results, early_answer_or_None) for high-confidence patterns,
        or None to fall through to the LLM tool loop.
        """
        q = question.lower()

        detail_keywords = ["pay rate", "salary", "wage", "details", "profile",
                           "position", "department of", "manager of", "email of",
                           "age of", "is married", "is he", "is she", "marital"]
        if any(kw in q for kw in detail_keywords):
            name = _extract_employee_name(question)
            if name:
                try:
                    await self.client.call("log_audit_event", {
                        "tool": "get_employee_details", "query": question,
                        "user_id": self.user_id, "status": "ok",
                    })
                except Exception:
                    pass
                result = await self.client.call("get_employee_details", {"name": name})
                return ([f"[get_employee_details]\n{result}"], None)

        dept_match = re.search(
            r"how many.+(?:in|from|within)\s+(?:the\s+)?([a-zA-Z\s]+?)\s*(?:department|dept|team)?[?.]?$",
            q,
        )
        if dept_match:
            result = await self.client.call("get_department_analytics", {})
            return ([f"[get_department_analytics]\n{result}"], None)

        return None

    async def _keyword_fallback(self, question: str) -> str:
        q = question.lower()
        name = _extract_employee_name(question)
        if any(kw in q for kw in ["pay rate", "salary", "wage", "details", "profile"]) and name:
            return await self.client.call("get_employee_details", {"name": name})
        if re.search(r"how many.+(?:in|from).+(?:department|dept|team)", q):
            return await self.client.call("get_department_analytics", {})
        if any(w in q for w in ["policy", "leave", "pto", "benefit", "conduct", "remote"]):
            return await self.client.call("search_hr_policy", {"query": question})
        if any(w in q for w in ["summary", "overview", "kpi", "workforce", "company"]):
            return await self.client.call("get_workforce_summary", {})
        if "department" in q and any(w in q for w in ["analytic", "stat", "breakdown"]):
            return await self.client.call("get_department_analytics", {})
        if "org" in q or "direct report" in q:
            return await self.client.call("get_org_chart", {})
        return await self.client.call("search_employees", {"name": question})


# ─────────────────────────────────────────────────────────────────────────────
# Sync wrapper (kept for Streamlit compatibility)
# ─────────────────────────────────────────────────────────────────────────────

_loop: asyncio.AbstractEventLoop | None = None
_mcp_client: MCPClient | None = None
_agent: HRAgent | None = None


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
    return _loop


def get_agent(user_id: str = "anonymous") -> HRAgent:
    global _mcp_client, _agent
    if _agent is None:
        _mcp_client = MCPClient()
        _get_loop().run_until_complete(_mcp_client.connect())
        _agent = HRAgent(_mcp_client, user_id=user_id)
    return _agent


def ask_sync(question: str, chat_history: list[dict], user_id: str = "anonymous") -> str:
    agent = get_agent(user_id)
    return _get_loop().run_until_complete(agent.ask(question, chat_history))