# Jotform AI Agent Auto-Preview (React Edition)

Instantly test your Jotform AI Agent after each configuration change — now with a redesigned, modern React frontend.

---

## 🚀 Features

* **Add Knowledge**

  * Add textual knowledge to your AI agent.
  * Generates a test prompt automatically to verify integration.

* **Add Action**

  * Define triggers (e.g. "User Talks About", "Sentence Contains").
  * Set responses (e.g. "Say Exact Message" or send API requests).
  * Automatically tests the new behavior.

* **Change Persona**

  * Update agent name, role, language, tone, chattiness, and guidelines.
  * Instantly previews new persona configuration.

* **Batch Mode**

  * Modify multiple settings (knowledge, actions, persona) in a single go.

* **Live Previews**

  * View greeting, prompt, and agent response for every change.

* **Redesigned UI**

  * Built with React for a dynamic and professional user experience.

---

## 📦 Tech Stack

* **Frontend**: React + TypeScript (Next.js)
* **Backend**: Flask (Python)
* **API Integration**: Reverse-engineered Jotform Agent Web APIs
* **OpenAI GPT**: Used for test prompt generation
* **Env Management**: `python-dotenv`

---

## 🛠️ Getting Started

### Prerequisites

* Python 3.8+
* Node.js 18+
* Jotform Session Cookie
* OpenAI API Key

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-org/jotform-ai-preview.git
   cd jotform-ai-preview
   ```

2. **Install backend dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**

   ```bash
   cd frontend
   npm install
   ```

4. **Create `.env` file**

   ```ini
   # .env
   JOTFORM_SESSION=your_jotform_session_cookie
   OPENAI_API_KEY=your_openai_api_key
   ```

### Running the App

In the root directory:

```bash
python app.py
```

In the `frontend/` directory (in a second terminal):

```bash
npm run dev
```

* Frontend runs on `http://localhost:3000`
* Backend runs on `http://localhost:5000`

---

## 🗂️ Project Structure

```
.
├── app.py                # Flask backend with endpoints
├── jotform_client.py     # Handles API calls to Jotform
├── requirements.txt
├── .env
├── frontend/             # React (Next.js) frontend
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── styles/
│   └── ...
└── static/               # Legacy static HTML (no longer primary)
```

---

## 🔗 API Endpoints (Flask)

| Endpoint          | Method | Description                            |
| ----------------- | ------ | -------------------------------------- |
| `/add_knowledge`  | POST   | Add knowledge and test it              |
| `/add_action`     | POST   | Add action and test it                 |
| `/update_name`    | POST   | Change agent name                      |
| `/update_role`    | POST   | Change agent role                      |
| `/add_guideline`  | POST   | Add a chat guideline                   |
| `/update_persona` | POST   | Change tone, language, chattiness, etc |
| `/batch_update`   | POST   | Send multiple changes at once          |

---

## 💡 How It Works

1. **React Frontend** collects Agent ID and user configurations.
2. **Flask Backend** pushes data to Jotform via `JotformAIAgentClient`.
3. A test prompt is generated using GPT to simulate the change.
4. The system opens a new chat, sends the prompt, and collects results.
5. The frontend displays:

   * Initial Greeting
   * Test Prompt
   * Agent Response
   * Raw JSON

---

## 👥 Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/foo`)
3. Commit your changes (`git commit -am 'Add feature foo'`)
4. Push to your branch (`git push origin feature/foo`)
5. Open a Pull Request

---

## 📄 License

MIT License

---

*Happy testing—no more manual previews!*
