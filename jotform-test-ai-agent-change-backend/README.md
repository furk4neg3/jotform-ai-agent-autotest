# Jotform AI Agent Auto-Preview

Automatically test your Jotform AI Agent immediately after any configuration change—no more manual “Preview” clicks.

---

## 🚀 Features

* **Add Knowledge**
  
  Push new knowledge materials (text) to your agent and instantly generate a test question to verify integration.

* **Add Action**
  
  Define triggers (e.g. “User Talks About”, “Sentence Contains”) and corresponding actions (e.g. “Say Exact Message”) and automatically validate them via a generated prompt.

* **Change Persona**
  
  Update agent properties—name, role, language, tone, chattiness, or add chat guidelines—and see live conversational previews.

* **Unified UI**
  
  A single-page interface to configure your agent, powered by Flask and a React-like vanilla JS front-end.

---

## 📦 Tech Stack

* **Backend**: Flask (Python)
* **Custom HTTP Client:** Reverse-engineered Jotform’s hidden AI Agent web API via browser DevTools (network tab & cURL) to implement all agent-builder calls from scratch
* **Jotform Client**: `JotformAIAgentClient` wrapping Jotform AI Agent Builder & Chat APIs
* **AI Prompting**: OpenAI GPT (via `openai` Python SDK)
* **Frontend**: Static HTML/CSS/JS (`index.html`) served from `static/`
* **Environment Management**: python-dotenv

---

## 🛠️ Getting Started

### Prerequisites

* Python 3.8+
* A Jotform **Session Token** (for authenticated API calls)
* An **OpenAI API Key**

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-org/jotform-ai-preview.git
   cd jotform-ai-preview
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env`**

   ```ini
   # .env
   JOTFORM_SESSION=your_jotform_session_cookie
   OPENAI_API_KEY=your_openai_api_key
   ```

### Running the App

```bash
python app.py
```

By default, Flask will serve on `http://localhost:5000/`. Open that in your browser to load the configuration UI.

---

## 🗂️ Project Structure

```
.
├── app.py                # Flask app defining all endpoints (/add_knowledge, /add_action, etc.)
├── jotform_client.py     # JotformAIAgentClient: wrappers for materials, tasks, properties, chats
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (not committed)
└── static/
    └── index.html        # Single-page UI for agent configuration and live preview
```

---

## 🔌 API Endpoints

| Endpoint          | Method | Description                                                      |
| ----------------- | ------ | ---------------------------------------------------------------- |
| `/`               | GET    | Serve the static configuration UI                                |
| `/add_knowledge`  | POST   | Add new knowledge and preview via generated test prompt          |
| `/add_action`     | POST   | Add new action and preview via generated test prompt             |
| `/update_name`    | POST   | Rename agent, then preview                                       |
| `/update_role`    | POST   | Change agent role, then preview                                  |
| `/add_guideline`  | POST   | Append a chat guideline to persona, then preview                 |
| `/update_persona` | POST   | Update any persona property (language, tone, etc.), then preview |

---

## 💡 How It Works

1. **Configuration** (UI): you enter your **Agent ID** and configure knowledge, actions, or persona.
2. **Backend Flow** (e.g. in `/add_knowledge`):

   * Calls `client.add_knowledge(...)` to push new material.
   * Uses OpenAI to generate a single test prompt (`generate_test_prompt`).
   * Invokes `client._preview_change(...)` to start a fresh chat and run the prompt, capturing both greeting and agent reply.
3. **Results Display**: The UI parses the JSON and renders:

   * **Initial Greeting**
   * **Test Prompt**
   * **Agent Response**
   * **Raw API Result**

---

## 🤝 Contributing

1. Fork and create a branch (`git checkout -b feature/foo`)
2. Commit your changes (`git commit -am 'Add some foo'`)
3. Push to the branch (`git push origin feature/foo`)
4. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

*Happy testing—no more manual previews!*
