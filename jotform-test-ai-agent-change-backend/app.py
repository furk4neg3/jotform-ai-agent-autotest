from flask import Flask, request, jsonify
from jotform_client import JotformAIAgentClient
import openai
import os
import json
from dotenv import load_dotenv
from flask_cors import CORS
import threading
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

load_dotenv()       

# Load env vars
JOTFORM_SESSION = os.getenv('JOTFORM_SESSION')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

gpt_client = openai.OpenAI(api_key=OPENAI_API_KEY)
client = JotformAIAgentClient(
    session_token=JOTFORM_SESSION
)


def send_preview_messages(agent_id: str, chat_id: str, ops: list):
    """
    Background helper that sends the initial greeting
    and then one test-prompt per operation.
    """
    try:

        # 2) for each op, build the same prompt you used
        for op in ops:
            typ = op.get("type")
            prompt = None

            if typ == "knowledge":
                title = op.get("title", "Knowledge")
                data  = op["data"]
                prompt = generate_test_prompt(title, data, mode="knowledge")

            elif typ == "action":
                # mirror your build_causes_and_tasks + generate_test_prompt call
                trigger = op.get("trigger_value", "")
                action_val = op.get("action_value", {})
                prompt = generate_test_prompt(trigger, json.dumps(action_val), mode="action")

            elif typ == "update_persona":
                prompt = generate_test_prompt("", "", mode="persona")

            # else: skip unknown ops
            if prompt:
                client.send_message(agent_id, chat_id, prompt, is_first_question=False)

    except Exception as e:
        print(f"[bg send_preview_messages] error: {e}")

def generate_test_prompt(title: str, data: str, mode: str) -> str:
    """
    Use GPT to create a single question to exercise the new knowledge or action.
    mode: 'knowledge' | 'action' | 'persona'
    """
    system = {
        'role': 'system',
        'content': 'You are a helpful assistant that generates test prompts. You act as a chatbot user, so act like a user at all times.'
    }
    if mode == 'knowledge':
        user = {
            'role': 'user',
            'content': f"The agent that you're talking to has knowledge {data}. Create a prompt that will make the agent answer using that knowledge."  
        }
    elif mode == 'action': 
        user = {
            'role': 'user',
            'content': f"Generate a single user message that would trigger the action for this action defined: {data}"  
        }
    elif mode == 'persona' and data is None:
        user = {
            'role': 'user',
            'content': "Have a casual conversation. ACT AS A CHATBOT USER, NOT AS A CHATBOT. IMMEDIATELY START ACTING DONT SAY THINGS LIKE -SURE- OR ANYTHING."  
        }
    else:
        user = {
            'role': 'user',
            'content': f"Have a casual conversation in {data}. ACT AS A CHATBOT USER, NOT AS A CHATBOT. IMMEDIATELY START ACTING DONT SAY THINGS LIKE -SURE- OR ANYTHING."  
        }

    try:
        resp = gpt_client.chat.completions.create(
            model='gpt-4o-mini',  # Fixed: Use valid model name
            messages=[system, user], 
            max_tokens=50
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"Error generating prompt: {str(e)}"


@app.route('/add_knowledge', methods=['POST'])
def add_knowledge():
    try:
        payload = request.json
        agent_id = payload.get('agent_id')
        data = payload.get('data')
        
        if not agent_id or not data:
            return jsonify({'error': 'Agent ID and data are required'}), 400

        title = "Knowledge"

        # 1) Add to agent
        api_res = client.add_knowledge(agent_id, title, data)
        title = api_res.get('content', {}).get('title', title)
        
        # 2) Generate test prompt
        prompt = generate_test_prompt(title, data, mode='knowledge')

        # 3) Preview change
        preview = client._preview_change(agent_id, prompt)
        
        # Extract initial message and reply
        initial_msg = None
        reply_msg = None
        
        if isinstance(preview, dict) and 'greeting' in preview and 'agent' in preview:
            # Extract greeting message
            greeting_resp = preview['greeting']
            if isinstance(greeting_resp, dict):
                initial_msg = client.extract_message(greeting_resp)
            
            # Extract agent response
            agent_resp = preview['agent']
            if isinstance(agent_resp, dict):
                reply_msg = client.extract_message(agent_resp)
        elif isinstance(preview, str):
            reply_msg = preview

        return jsonify({
            'initial_message': initial_msg,
            'api_result': api_res,
            'prompt': prompt,
            'reply': reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/add_action', methods=['POST'])
def add_action():
    try:
        # 1) Get inputs
        payload = request.json
        agent_id = payload.get('agent_id')
        trigger_type = payload.get('trigger_type')
        trigger_value = payload.get('trigger_value')
        action_type = payload.get('action_type')
        action_value = payload.get('action_value')
        
        if (not all([agent_id, trigger_type, trigger_value, action_type, action_value]) and not (action_type == "show-screen-share-button") and not (trigger_type == "conversation-start")):
            return jsonify({'error': 'All fields are required'}), 400

        # 2) Create parameters from user defined values
        if trigger_type == "talks-about":
            agent_trigger = [{"type": "talks-about", "value": {"about": trigger_value}}]
        elif trigger_type == "sentiment":
            agent_trigger = [{"type": "sentiment", "value": {"sentiment": trigger_value}}]
        elif trigger_type == "ask-about":
            agent_trigger = [{"type": "ask-about", "value": {"about": trigger_value}}]
        elif trigger_type == "conversation-start":
            agent_trigger = [{"type": "conversation-start", "value": {}}]
        elif trigger_type == "intention":
            agent_trigger = [{"type": "intention", "value": {"state": trigger_value}}]
        elif trigger_type == "provides":
            agent_trigger = [{"type": "provides", "value": {"provides": trigger_value}}]
        elif trigger_type == "sentence-contains":
            agent_trigger = [{"type": "sentence-contains", "value": {"keyword": trigger_value}}]
        elif trigger_type == "date-time":
            agent_trigger = [{"type": "date-time", "value": {"specify": trigger_value}}]
        elif trigger_type == "url-contains":
            agent_trigger = [{
                "type": "url-contains",
                "value": {"contains": trigger_value}
            }]
        else:
            return jsonify({'error': f'Invalid trigger type:{trigger_type}'}), 400
        
        if action_type == "talk-about":
            agent_action = [{"type": "talk-about", "value": {"about": action_value}}]
        elif action_type == "say-exact-message":
            agent_action = [{"type": "say-exact-message", "value": {"message": action_value}}]
        elif action_type == "collect-value":
            agent_action = [{
                "type": "collect-value",
                "value": [{
                    "field_name": {"value": action_value},
                    "field_type": {"value": "control_textarea"}
                }]
            }]
        elif action_type == "always-include":
            agent_action = [{"type": "always-include", "value": {"include": action_value}}]
        elif action_type == "always-talk-about":
            agent_action = [{"type": "always-talk-about", "value": {"about": action_value}}]
        elif action_type == "fill-form":
            agent_action = [{"type": "fill-form", "value": {"form": action_value}}]
        elif action_type == "show-button":
            # action_value is now a dict: { text: "...", url: "..." }
            text = action_value.get("text", "")
            url  = action_value.get("url", "")
            agent_action = [{
                "type": "show-button",
                "value": {
                    "button": "redirect-url",
                    "text": text,
                    "url": url
                }
            }]
        elif action_type == "send-email":
            # expect action_value to be a dict with keys:
            #   subject, content, senderName, replyTo, recipient
            props = action_value
            agent_action = [{
                "type": "send-email",
                "value": {
                    "emailProperties": {
                        # minimal fields; you can extend this with Jotform defaults if needed
                        "subject":  props.get("subject", ""),
                        "content":  props.get("content", ""),
                        "from":     props.get("senderName", ""),
                        "replyTo":  [{"value": props.get("replyTo",""), "text": props.get("replyTo",""), "isValid": True}],
                        "to":       [{"text": props.get("recipient",""), "isValid": True}],
                        # leave other emailProperties at their defaults (Jotform will fill them)
                    }
                }
            }]
        elif action_type == "send-api-request":
            props    = action_value or {}
            endpoint = props.get("endpoint", "")
            method   = props.get("method", "GET").upper()
            agent_action = [{
                "type": "send-api-request",
                "value": {
                    "endpoint": endpoint,
                    "method":   method
                }
            }]
        elif action_type == "search-in-website":
            props      = action_value or {}
            website    = props.get("website", "")
            searchfor  = props.get("searchfor", "")

            agent_action = [{
                "type": "search-in-website",
                "value": {
                    "website":   website,
                    "searchfor": searchfor
                }
            }]
        elif action_type == "show-video":
            # props comes in as { platform: "...", url: "..." }
            props    = action_value or {}
            platform = props.get("platform", "")
            url      = props.get("url", "")

            agent_action = [{
                "type": "show-video",
                "value": {
                    "platform": platform,
                    "rule":     url
                }
            }]
        elif action_type == "use-knowledge-base":
            props      = request.json.get('action_value', {}) or {}
            knowledge  = props.get('knowledge', '')
            # if they passed an object, stringify it
            if isinstance(knowledge, dict):
                knowledge = json.dumps(knowledge)

            agent_action = [{
                "type": "use-knowledge-base",
                "value": {
                    "knowledge": knowledge
                }
            }]
        elif action_type == "show-screen-share-button":
            # No inputs needed—just send an empty value object
            agent_action = [{
                "type": "show-screen-share-button",
                "value": {}
            }]
        else:
            return jsonify({'error': 'Invalid action type'}), 400
        
        # 3) Add action to agent
        api_res = client.add_action(
            agent_id,
            link="ANY",
            status="ACTIVE",
            action_type="BASIC",
            order=2,
            causes=agent_trigger,
            tasks=agent_action,
            channels=["all", "standalone", "chatbot", "phone", "voice", "messenger", "sms", "whatsapp"]
        )

        # use cause keyword values joined
        gpt_prompt = json.dumps(agent_trigger)
        prompt = generate_test_prompt('', gpt_prompt, mode='action')
        
        # 4) Preview change
        preview = client._preview_change(agent_id, prompt)
        
        # Extract initial message and reply
        initial_msg = None
        reply_msg = None
        
        if isinstance(preview, dict) and 'greeting' in preview and 'agent' in preview:
            # Extract greeting message
            greeting_resp = preview['greeting']
            if isinstance(greeting_resp, dict):
                initial_msg = client.extract_message(greeting_resp)
            
            # Extract agent response
            agent_resp = preview['agent']
            if isinstance(agent_resp, dict):
                reply_msg = client.extract_message(agent_resp)
        elif isinstance(preview, str):
            reply_msg = preview

        return jsonify({
            'initial_message': initial_msg,
            'api_result': api_res,
            'prompt': prompt,
            'reply': reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/update_persona', methods=['POST'])
def update_persona():
    try:
        payload = request.json
        agent_id = payload.get('agent_id')
        update_prop = payload.get('update_prop')
        update_value = payload.get('update_value')
        if action_type == "show-screen-share-button":
            emptyable = True
        else:
            emptyable = False
        
        if not all([agent_id, trigger_type, trigger_value, action_type, action_value]):
            return jsonify({'error': 'All fields are required'}), 400
        
        update_prop_type = "agent"

        api_res = client.update_property(agent_id, update_prop, update_value, update_prop_type)
        
        if update_prop == "language":
            prompt = prompt = generate_test_prompt('', update_value, mode='persona')
        else:
            prompt = generate_test_prompt('', '', mode='persona')
        
        # 3) Preview change
        preview = client._preview_change(agent_id, prompt)
        
        # Extract initial message and reply
        initial_msg = None
        reply_msg = None
        
        if isinstance(preview, dict) and 'greeting' in preview and 'agent' in preview:
            # Extract greeting message
            greeting_resp = preview['greeting']
            if isinstance(greeting_resp, dict):
                initial_msg = client.extract_message(greeting_resp)
            
            # Extract agent response
            agent_resp = preview['agent']
            if isinstance(agent_resp, dict):
                reply_msg = client.extract_message(agent_resp)
        elif isinstance(preview, str):
            reply_msg = preview

        return jsonify({
            'initial_message': initial_msg,
            'api_result': api_res,
            'prompt': prompt,
            'reply': reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@app.route('/update_name', methods=['POST'])
def update_name():
    try:
        payload = request.json
        agent_id = payload.get('agent_id')
        new_name = payload.get('name')
        if not agent_id or not new_name:
            return jsonify({'error': 'Agent ID and new name are required'}), 400

        # 1) Rename via PUT
        api_res = client.update_agent_name(agent_id, new_name)

        # 2) Preview change with a generic persona prompt
        prompt = generate_test_prompt('', '', mode='persona')
        preview = client._preview_change(agent_id, prompt)

        # 3) Extract greeting & reply
        initial_msg = None
        reply_msg = None
        if isinstance(preview, dict):
            greeting = preview.get('greeting') or {}
            agent_resp = preview.get('agent') or {}
            initial_msg = client.extract_message(greeting)
            reply_msg = client.extract_message(agent_resp)

        return jsonify({
            'initial_message': initial_msg,
            'api_result': api_res,
            'prompt': prompt,
            'reply': reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/update_role', methods=['POST'])
def update_role():
    try:
        payload = request.json
        agent_id = payload.get('agent_id')
        new_role = payload.get('role')
        if not agent_id or not new_role:
            return jsonify({'error': 'Agent ID and new role are required'}), 400

        # 1) Set role via properties endpoint
        api_res = client.update_property(agent_id, 'role', new_role, 'agent')

        # 2) Preview change
        prompt = generate_test_prompt('', '', mode='persona')
        preview = client._preview_change(agent_id, prompt)

        initial_msg = None
        reply_msg = None
        if isinstance(preview, dict):
            greeting = preview.get('greeting') or {}
            agent_resp = preview.get('agent') or {}
            initial_msg = client.extract_message(greeting)
            reply_msg = client.extract_message(agent_resp)

        return jsonify({
            'initial_message': initial_msg,
            'api_result': api_res,
            'prompt': prompt,
            'reply': reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add_guideline', methods=['POST'])
def add_guideline():
    try:
        payload = request.json
        agent_id  = payload.get('agent_id')
        guideline = payload.get('guideline')
        if not agent_id or not guideline:
            return jsonify({'error': 'Agent ID and guideline text are required'}), 400

        # 1) Append via client
        api_res = client.add_chat_guideline(agent_id, guideline)

        # 2) Preview with existing prompt flow
        prompt  = generate_test_prompt('', '', mode='persona')
        preview = client._preview_change(agent_id, prompt)

        # 3) Extract greeting & reply
        initial_msg = reply_msg = None
        if isinstance(preview, dict):
            initial_msg = client.extract_message(preview.get('greeting') or {})
            reply_msg   = client.extract_message(preview.get('agent')   or {})

        return jsonify({
            'initial_message': initial_msg,
            'api_result':      api_res,
            'prompt':          prompt,
            'reply':           reply_msg
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_forms', methods=['GET'])
def get_forms():
    """
    Fetch all non-deleted Jotform forms for the current user.
    """
    url = 'https://www.jotform.com/API/user/forms'
    params = {
        # filter out deleted/purged forms
        'filter': json.dumps({"status:ne": ["DELETED", "PURGED"]}),
        'offset': 0,
        'orderby': 'updated_at',
        'limit': 10000,
        'includeSharedForms': 0,
        'checkDocuments': 0
    }
    resp = client.session.get(url, params=params)
    print(resp)
    resp.raise_for_status()
    forms = resp.json().get('content', [])
    # return the array of { id, title, … }
    return jsonify(forms)

@app.route('/get_materials/<agent_id>', methods=['GET'])
def get_materials(agent_id):
    """
    Proxy to Jotform’s GET /materials for the given agent.
    """
    url = f'https://www.jotform.com/API/ai-agent-builder/agents/{agent_id}/materials'
    try:
        resp = client.session.get(url)
        print(resp)
        resp.raise_for_status()
        return jsonify(resp.json().get('content', []))
    except Exception as e:
        app.logger.exception("Error in /get_materials")
        return jsonify({'error': str(e)}), 500

def build_causes_and_tasks(trigger_type, trigger_value, action_type, action_value):
    # 1) Build causes (agent_trigger)
    if trigger_type == "talks-about":
        agent_trigger = [{"type": "talks-about", "value": {"about": trigger_value}}]
    elif trigger_type == "sentiment":
        agent_trigger = [{"type": "sentiment", "value": {"sentiment": trigger_value}}]
    elif trigger_type == "ask-about":
        agent_trigger = [{"type": "ask-about", "value": {"about": trigger_value}}]
    elif trigger_type == "conversation-start":
        agent_trigger = [{"type": "conversation-start", "value": {}}]
    elif trigger_type == "intention":
        agent_trigger = [{"type": "intention", "value": {"state": trigger_value}}]
    elif trigger_type == "provides":
        agent_trigger = [{"type": "provides", "value": {"provides": trigger_value}}]
    elif trigger_type == "sentence-contains":
        agent_trigger = [{"type": "sentence-contains", "value": {"keyword": trigger_value}}]
    elif trigger_type == "date-time":
        agent_trigger = [{"type": "date-time", "value": {"specify": trigger_value}}]
    elif trigger_type == "url-contains":
        agent_trigger = [{
            "type": "url-contains",
            "value": {"contains": trigger_value}
        }]
    else:
        return jsonify({'error': f'Invalid trigger type:{trigger_type}'}), 400
    
    if action_type == "talk-about":
        agent_action = [{"type": "talk-about", "value": {"about": action_value}}]
    elif action_type == "say-exact-message":
        agent_action = [{"type": "say-exact-message", "value": {"message": action_value}}]
    elif action_type == "collect-value":
        agent_action = [{
            "type": "collect-value",
            "value": [{
                "field_name": {"value": action_value},
                "field_type": {"value": "control_textarea"}
            }]
        }]
    elif action_type == "always-include":
        agent_action = [{"type": "always-include", "value": {"include": action_value}}]
    elif action_type == "always-talk-about":
        agent_action = [{"type": "always-talk-about", "value": {"about": action_value}}]
    elif action_type == "fill-form":
        agent_action = [{"type": "fill-form", "value": {"form": action_value}}]
    elif action_type == "show-button":
        # action_value is now a dict: { text: "...", url: "..." }
        text = action_value.get("text", "")
        url  = action_value.get("url", "")
        agent_action = [{
            "type": "show-button",
            "value": {
                "button": "redirect-url",
                "text": text,
                "url": url
            }
        }]
    elif action_type == "send-email":
        # expect action_value to be a dict with keys:
        #   subject, content, senderName, replyTo, recipient
        props = action_value
        agent_action = [{
            "type": "send-email",
            "value": {
                "emailProperties": {
                    # minimal fields; you can extend this with Jotform defaults if needed
                    "subject":  props.get("subject", ""),
                    "content":  props.get("content", ""),
                    "from":     props.get("senderName", ""),
                    "replyTo":  [{"value": props.get("replyTo",""), "text": props.get("replyTo",""), "isValid": True}],
                    "to":       [{"text": props.get("recipient",""), "isValid": True}],
                    # leave other emailProperties at their defaults (Jotform will fill them)
                }
            }
        }]
    elif action_type == "send-api-request":
        props    = action_value or {}
        endpoint = props.get("endpoint", "")
        method   = props.get("method", "GET").upper()
        agent_action = [{
            "type": "send-api-request",
            "value": {
                "endpoint": endpoint,
                "method":   method
            }
        }]
    elif action_type == "search-in-website":
        props      = action_value or {}
        website    = props.get("website", "")
        searchfor  = props.get("searchfor", "")

        agent_action = [{
            "type": "search-in-website",
            "value": {
                "website":   website,
                "searchfor": searchfor
            }
        }]
    elif action_type == "show-video":
        # props comes in as { platform: "...", url: "..." }
        props    = action_value or {}
        platform = props.get("platform", "")
        url      = props.get("url", "")

        agent_action = [{
            "type": "show-video",
            "value": {
                "platform": platform,
                "rule":     url
            }
        }]
    elif action_type == "use-knowledge-base":
        props      = request.json.get('action_value', {}) or {}
        knowledge  = props.get('knowledge', '')
        # if they passed an object, stringify it
        if isinstance(knowledge, dict):
            knowledge = json.dumps(knowledge)

        agent_action = [{
            "type": "use-knowledge-base",
            "value": {
                "knowledge": knowledge
            }
        }]
    elif action_type == "show-screen-share-button":
        # No inputs needed—just send an empty value object
        agent_action = [{
            "type": "show-screen-share-button",
            "value": {}
        }]
    else:
        return jsonify({'error': 'Invalid action type'}), 400
    return agent_trigger, agent_action

@app.route('/batch_update', methods=['POST'])
def batch_update():
    try:
        payload  = request.get_json()
        agent_id = payload.get('agent_id')
        ops      = payload.get('operations', [])
        if not agent_id or not ops:
            return jsonify({'error': 'Need agent_id and a non-empty operations list'}), 400

        # ── 1) apply all of the ops up-front ──
        for op in ops:
            typ = op.get("type")

            if typ == "knowledge":
                title = op.get("title", "Knowledge")
                data  = op["data"]
                client.add_knowledge(agent_id, title, data)

            elif typ == "action":
                # reuse your existing builder
                causes, tasks = build_causes_and_tasks(
                    op["trigger_type"],
                    op["trigger_value"],
                    op["action_type"],
                    op["action_value"]
                )
                client.add_action(
                    agent_id,
                    link     = "ANY",
                    status   = "ACTIVE",
                    action_type = "BASIC",
                    order    = 2,
                    causes   = causes,
                    tasks    = tasks,
                    channels = ["all","standalone","chatbot","phone","voice","messenger","sms","whatsapp"]
                )

            elif typ == "update_persona":
                # same as your old persona-update logic
                if op.get("name"):
                    client.update_property(agent_id, 'name', op['name'], 'agent')
                elif op.get("role"):
                    client.update_property(agent_id, 'role', op['role'], 'agent')
                elif op.get("guideline"):
                    client.add_chat_guideline(agent_id, op['guideline'])
                else:
                    client.update_property(
                        agent_id,
                        op['update_prop'],
                        op['update_value'],
                        'agent'
                    )

            else:
                raise ValueError(f"Unknown operation type: {typ}")

          # ── 2) create the preview chat ──
        chat_resp = client.create_chat(agent_id)
        chat_id   = chat_resp["content"]["id"]

        # ── 2.5) send the initial greeting synchronously ──
        client.send_message(agent_id, chat_id, "Hi, how are you?", is_first_question=True)

        # ── 3) spawn background sender for the rest of the prompts ──
        threading.Thread(
            target=send_preview_messages,
            args=(agent_id, chat_id, ops),
            daemon=True
        ).start()

        # ── 4) return so frontend can open iframe ──
        return jsonify({'chat_id': chat_id})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/config', methods=['GET'])
def config():
    return jsonify({
        'jotformApiKey': os.getenv('JOTFORM_API_KEY'),
        'flaskApiUrl': 'http://127.0.0.1:5000'
    })


@app.route('/')
def serve_ui():
    return app.send_static_file('index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)