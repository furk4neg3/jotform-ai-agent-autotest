import requests
import json
from typing import Any, Dict, List, Optional


class JotformAIAgentClient:
    """
    A client for interacting with Jotform AI Agent Builder and Chat endpoints.

    Provides methods to add knowledge materials, actions, properties,
    to create and start chats, send messages, and extract replies.
    """
    BASE_URL = "https://www.jotform.com/API/ai-agent-builder/agents"
    CHAT_URL = "https://agent.jotform.com/API/ai-agent"
    DEFAULT_REFERER = "https://agent.jotform.com"
    DEFAULT_ORIGIN  = "https://www.jotform.com"

    def __init__(
        self,
        api_key: Optional[str] = None,
        session_token: Optional[str] = None,
        jf_client_id: Optional[str] = None,
    ):
        """
        Initialize client with optional API key, session token, and jf-client-id.
        Automatically sets Origin and Referer headers.
        """
        self.session = requests.Session()
        if api_key:
            self.session.params.update({"apiKey": api_key})
        if session_token:
            self.session.cookies.set("JOTFORM_SESSION", session_token)
        headers = {"Origin": self.DEFAULT_ORIGIN, "Referer": self.DEFAULT_REFERER}
        if jf_client_id:
            headers["jf-client-id"] = jf_client_id
        self.session.headers.update(headers)

    def add_knowledge(self, agent_id: str, title: str, data: str, material_type: str = "TEXT") -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{agent_id}/materials"
        resp = self.session.post(url, json={"type": material_type, "title": title, "data": data})
        resp.raise_for_status()
        return resp.json()

    def add_action(
        self,
        agent_id: str,
        link: str,
        status: str,
        action_type: str,
        order: int,
        causes: List[Dict[str, Any]],
        tasks: List[Dict[str, Any]],
        channels: List[str],
    ) -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{agent_id}/tasks"
        resp = self.session.post(url, json={
            "link": link,
            "status": status,
            "type": action_type,
            "order": order,
            "causes": causes,
            "tasks": tasks,
            "channels": channels,
        })
        resp.raise_for_status()
        return resp.json()

    def update_property(self, agent_id: str, prop: str, value: Any, prop_type: str = "agent") -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{agent_id}/properties"
        resp = self.session.post(url, json={"prop": prop, "value": value, "type": prop_type})
        resp.raise_for_status()
        return resp.json()

    def create_chat(
        self,
        agent_id: str,
        allow_multiple_actions: bool = True,
        master_prompt: bool = True,
        no_buffering: bool = True,
        is_first_question: bool = True,
    ) -> Dict[str, Any]:
        """
        Create (start) a new chat session. Returns raw JSON with 'content.id' as chatID.
        """
        url = f"{self.CHAT_URL}/{agent_id}/chats"
        params = {
            "allowMultipleActions": int(allow_multiple_actions),
            "masterPrompt": int(master_prompt),
            "noBuffering": int(no_buffering),
        }
        payload = {"isFirstQuestion": is_first_question}
        resp = self.session.post(url, params=params, json=payload, headers=self._minimal_headers())
        resp.raise_for_status()
        return resp.json()

    def send_message(
        self,
        agent_id: str,
        chat_id: str,
        message: str,
        is_first_question: bool = False,
        is_past_question: bool = False,
        allow_multiple_actions: bool = True,
        master_prompt: bool = True,
        no_buffering: bool = True,
        message_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Send a user message and retrieve the response. Parses JSON or newline-delimited stream.
        """
        url = f"{self.CHAT_URL}/{agent_id}/chats/{chat_id}"
        params = {
            "allowMultipleActions": int(allow_multiple_actions),
            "masterPrompt": int(master_prompt),
            "noBuffering": int(no_buffering),
        }
        payload = {
            "chatID": chat_id,
            "answer": message,
            "answerType": None,
            "isFirstQuestion": is_first_question,
            "isPastQuestion": is_past_question,
            "conversationFeedback": False,
            "messageHistory": message_history or [],
            "referrer": "https://www.jotform.com/",
            "platform": "direct",
            "messageType": "USER",
            "chatProps": {"isOneOne": False, "isMasterPrompt": master_prompt, "isFormCopilot": False},
            "messageProps": {"isVoice": False},
            "screenShareActive": False,
        }
        resp = self.session.post(url, params=params, json=payload, headers=self._minimal_headers())
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return self._parse_raw_stream(resp.text)

    def _preview_change(
        self,
        agent_id: str,
        prompt: str,
        is_first_question: bool = True
    ) -> Dict[str, Any]:
        """
        Preview changes by creating a chat and sending a prompt.
        Returns a dictionary with 'greeting' and 'agent' response data.
        """
        try:
            # 1) Start a fresh chat
            chat_resp = self.create_chat(agent_id)
            chat_id = chat_resp["content"]["id"]
            
            # 2) Get the greeting message
            greeting_resp = self.send_message(
                agent_id,
                chat_id,
                "",
                is_first_question=True
            )
            
            # 3) Send the test prompt
            agent_resp = self.send_message(
                agent_id,
                chat_id,
                prompt,
                is_first_question=False
            )
            
            # 4) Return both responses
            return {
                'greeting': greeting_resp,
                'agent': agent_resp
            }
        except Exception as e:
            return {'error': f"Error in preview: {str(e)}"}

    def update_agent_name(self, agent_id: str, name: str) -> Dict[str, Any]:
        """
        Rename the agent.
        """
        url = f"{self.BASE_URL}/{agent_id}"
        resp = self.session.put(url, json={"name": name})
        resp.raise_for_status()
        return resp.json()
    
    def get_properties(self, agent_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all properties for this agent.
        """
        url = f"{self.BASE_URL}/{agent_id}/properties"
        resp = self.session.get(url)
        resp.raise_for_status()
        data = resp.json()
        return data.get('content', [])

    def add_chat_guideline(self, agent_id: str, guideline: str) -> Dict[str, Any]:
        """
        Fetch current persona guidelines, append the new one, and PUT back.
        """
        props = self.get_properties(agent_id)
        # find existing persona entry
        persona = next((p for p in props if p['prop']=='persona'), None)
        existing = persona['value'] if persona else ''
        # build updated multiline value
        new_value = existing + '\n' + guideline if existing else guideline
        # reuse the generic update_property under the hood
        return self.update_property(agent_id, 'persona', new_value, 'agent')

    def extract_message(self, response: Dict[str, Any]) -> Optional[str]:
        """
        Extract the agent's reply text from a chat response dict.
        """
        # Handle error case
        if 'error' in response:
            return response['error']
            
        # New API format:
        content = response.get("content")
        if isinstance(content, dict) and "message" in content:
            return content.get("message")
        
        # Fallback to tasks array
        for task in response.get("tasks", []):
            if task.get("type", "").startswith("say"):
                return task["value"].get("message")
        
        return None

    def _minimal_headers(self) -> Dict[str, str]:
        """
        Return minimal, Latin-1-safe headers for chat requests.
        """
        headers = {"Origin": self.DEFAULT_ORIGIN, "Referer": self.DEFAULT_REFERER, "Content-Type": "application/json"}
        if "jf-client-id" in self.session.headers:
            headers["jf-client-id"] = self.session.headers["jf-client-id"]
        return headers

    def _parse_raw_stream(self, raw: str) -> Dict[str, Any]:
        """
        Parse newline-delimited JSON stream, return the most relevant object.
        """
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        objs: List[Dict[str, Any]] = []
        for line in lines:
            try:
                objs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        # prefer objects with responseCode
        for obj in reversed(objs):
            if "responseCode" in obj:
                return obj
        # prefer objects with content
        for obj in reversed(objs):
            if "content" in obj and isinstance(obj["content"], dict):
                return obj
        return objs[-1] if objs else {"_raw": raw}