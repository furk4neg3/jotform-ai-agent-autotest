"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Trash2, MessageSquare, X, Plus, Settings, Brain, Zap, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image";

interface QueuedOperation {
  id: string
  type: "knowledge" | "action" | "persona"
  data: any
  description: string
}

interface PersonaOptions {
  [key: string]: { value: string; label: string }[]
}

interface Config {
  jotformApiKey: string
  flaskApiUrl: string
}

const personaOptions: PersonaOptions = {
  language: [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "zh", label: "Chinese" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "ar", label: "Arabic" },
  ],
  tone: [
    { value: "casual", label: "Casual" },
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
  ],
  chattiness: [
    { value: "1", label: "Minimal (1)" },
    { value: "2", label: "Short (2)" },
    { value: "3", label: "Long (3)" },
    { value: "4", label: "Chatty (4)" },
  ],
}

export default function JotformAIAgent() {
  const [config, setConfig] = useState<Config | null>(null)
  const [agentId, setAgentId] = useState("")
  const [activeTab, setActiveTab] = useState("knowledge")
  const [queuedOps, setQueuedOps] = useState<QueuedOperation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Knowledge form state
  const [knowledgeData, setKnowledgeData] = useState("")

  // Action form state
  const [triggerType, setTriggerType] = useState("")
  const [triggerValue, setTriggerValue] = useState("")
  const [actionType, setActionType] = useState("")
  const [actionValue, setActionValue] = useState("")
  const [actionButtonText, setActionButtonText] = useState("")
  const [actionButtonUrl, setActionButtonUrl] = useState("")

  // Form lists and KBs
  const [forms, setForms] = useState<{ id: string; title: string }[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<{ uuid: string; title: string }[]>([]);

  // Email action state
  const [actionEmailSubject, setActionEmailSubject] = useState("");
  const [actionEmailContent, setActionEmailContent] = useState("");
  const [actionEmailSender, setActionEmailSender] = useState("");
  const [actionEmailReplyTo, setActionEmailReplyTo] = useState("");
  const [actionEmailRecipient, setActionEmailRecipient] = useState("");

  // API action state
  const [actionApiMethod, setActionApiMethod] = useState("GET");
  const [actionApiEndpoint, setActionApiEndpoint] = useState("");

  // Website search action state
  const [actionWebsiteUrl, setActionWebsiteUrl] = useState("");
  const [actionWebsiteSearchFor, setActionWebsiteSearchFor] = useState("");

  // Video action state
  const [actionVideoPlatform, setActionVideoPlatform] = useState("");
  const [actionVideoUrl, setActionVideoUrl] = useState("");
  const fetchForms = async () => {
    try {
      if(!config) return;
      const res = await fetch(`${config.flaskApiUrl}/get_forms`); 
      if (!res.ok) throw new Error(res.statusText);
      setForms(await res.json());
    } catch (e) {
      showError("Failed to load forms");
    }
  };

  const fetchKnowledgeBases = async () => {
    if (!agentId || !config) return;
    try {
      const res = await fetch(`${config.flaskApiUrl}/get_materials/${agentId}`);
      if (!res.ok) throw new Error(res.statusText);
      setKnowledgeBases(await res.json());
    } catch {
      showError("Failed to load knowledge bases");
    }
  };

  useEffect(() => {
    if (actionType === "fill-form") fetchForms();
    else if (actionType === "use-knowledge-base") fetchKnowledgeBases();
  }, [actionType, agentId]);

  // Persona form state
  const [personaProperty, setPersonaProperty] = useState("")
  const [personaValue, setPersonaValue] = useState("")
  const [agentName, setAgentName] = useState("")
  const [agentRole, setAgentRole] = useState("")
  const [newGuideline, setNewGuideline] = useState("")

  const [personaValueOptions, setPersonaValueOptions] = useState<{ value: string; label: string }[]>([])

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config")
        const configData = await response.json()
        setConfig(configData)
      } catch (error) {
        console.error("Failed to load config:", error)
        setError("Failed to load configuration")
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (personaProperty && personaOptions[personaProperty]) {
      setPersonaValueOptions(personaOptions[personaProperty])
    } else {
      setPersonaValueOptions([])
    }
    setPersonaValue("")
  }, [personaProperty])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const showError = (message: string) => {
    setError(message)
    setTimeout(() => setError(null), 5000)
  }

  const queueKnowledge = () => {
    if (!agentId || !knowledgeData) {
      showError("Enter both Agent ID and Knowledge content")
      return
    }

    const operation: QueuedOperation = {
      id: generateId(),
      type: "knowledge",
      data: { data: knowledgeData },
      description: `Add Knowledge: "${knowledgeData.substring(0, 50)}${knowledgeData.length > 50 ? "..." : ""}"`,
    }

    setQueuedOps((prev) => [...prev, operation])
    setKnowledgeData("")
  }

  const queueAction = () => {
    if (!agentId || !triggerType || !actionType) {
      showError("Enter Agent ID, Trigger Type, and Action Type")
      return
    }

    let actionValueData: any;
    if (actionType === "fill-form") {
      actionValueData = actionValue; // selected form ID
    } else if (actionType === "show-button") {
      actionValueData = { text: actionButtonText, url: actionButtonUrl };
    } else if (actionType === "send-email") {
      actionValueData = {
        subject: actionEmailSubject,
        content: actionEmailContent,
        senderName: actionEmailSender,
        replyTo: actionEmailReplyTo,
        recipient: actionEmailRecipient,
      };
    } else if (actionType === "send-api-request") {
      actionValueData = {
        method: actionApiMethod,
        endpoint: actionApiEndpoint,
      };
    } else if (actionType === "search-in-website") {
      actionValueData = {
        website: actionWebsiteUrl,
        searchfor: actionWebsiteSearchFor,
      };
    } else if (actionType === "show-video") {
      actionValueData = {
        platform: actionVideoPlatform,
        url: actionVideoUrl,
      };
    } else if (actionType === "use-knowledge-base") {
      actionValueData = actionValue; // selected KB ID
    } else if (actionType === "show-screen-share-button") {
      actionValueData = {};
    } else {
      actionValueData = actionValue;
    }

    const operation: QueuedOperation = {
      id: generateId(),
      type: "action",
      data: {
        trigger_type: triggerType,
        trigger_value: triggerValue,
        action_type: actionType,
        action_value: actionValueData,
      },
      description: `Add Action: ${triggerType} → ${actionType}`,
    }

    setQueuedOps((prev) => [...prev, operation])
    setTriggerType("")
    setTriggerValue("")
    setActionType("")
    setActionValue("")
    setActionButtonText("")
    setActionButtonUrl("")
    setActionEmailSubject("");
    setActionEmailContent("");
    setActionEmailSender("");
    setActionEmailReplyTo("");
    setActionEmailRecipient("");
    setActionApiMethod("GET");
    setActionApiEndpoint("");
    setActionWebsiteUrl("");
    setActionWebsiteSearchFor("");
    setActionVideoPlatform("");
    setActionVideoUrl("");
  }

  const queuePersona = () => {
    if (!agentId) {
      showError("Enter Agent ID")
      return
    }

    let operation: QueuedOperation
    if (agentName) {
      operation = {
        id: generateId(),
        type: "persona",
        data: { name: agentName },
        description: `Update Name: ${agentName}`,
      }
    } else if (agentRole) {
      operation = {
        id: generateId(),
        type: "persona",
        data: { role: agentRole },
        description: `Update Role: ${agentRole}`,
      }
    } else if (newGuideline) {
      operation = {
        id: generateId(),
        type: "persona",
        data: { guideline: newGuideline },
        description: `Add Guideline: ${newGuideline.substring(0, 30)}...`,
      }
    } else if (personaProperty && personaValue) {
      operation = {
        id: generateId(),
        type: "persona",
        data: { update_prop: personaProperty, update_value: personaValue },
        description: `Update ${personaProperty}: ${personaValue}`,
      }
    } else {
      showError("Fill a Name, Role, Guideline, or Property+Value")
      return
    }

    setQueuedOps((prev) => [...prev, operation])
    setAgentName("")
    setAgentRole("")
    setNewGuideline("")
    setPersonaProperty("")
    setPersonaValue("")
  }

  const deleteQueuedOperation = (id: string) => {
    setQueuedOps((prev) => prev.filter((op) => op.id !== id))
  }

  const executeBatch = async () => {
    if (!agentId) {
      showError("Please enter your Agent ID before applying changes.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const operations = queuedOps.map((op) => ({
        type: op.type === "persona" ? "update_persona" : op.type,
        ...op.data,
      }))

      const response = await fetch("/api/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          operations,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.chat_id) {
        setChatId(result.chat_id)
        setChatOpen(true)
        setQueuedOps([]) // Clear queue on success
      }
    } catch (error) {
      console.error("Error applying batch:", error)
      showError(error instanceof Error ? error.message : "Error applying changes")
    } finally {
      setIsLoading(false)
    }
  }

  const closeChat = () => {
    setChatOpen(false)
    setChatId(null)
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center">
                <Image
                  src="jotform-logo.svg"
                  alt="Jotform logo"
                  width={32}
                  height={32}
                />
                <span className="ml-2 text-xl font-semibold">AI Agent Builder</span>
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-orange-600 border-orange-200">
                Beta
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-500 ease-in-out",
          chatOpen ? "grid grid-cols-2 gap-8" : "max-w-4xl",
        )}
      >
        {/* Main Form */}
        <div className="space-y-6">
          {/* Agent ID Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-orange-500" />
                Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="agent-id" className="text-sm font-medium text-gray-700">
                  Agent ID
                </Label>
                <Input
                  id="agent-id"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Enter your agent ID"
                  className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Main Configuration */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b border-gray-200">
                  <TabsList className="w-full bg-transparent h-auto p-0 space-x-0">
                    <TabsTrigger
                      value="knowledge"
                      className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-4 px-6 font-medium"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Knowledge
                    </TabsTrigger>
                    <TabsTrigger
                      value="action"
                      className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-4 px-6 font-medium"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Actions
                    </TabsTrigger>
                    <TabsTrigger
                      value="persona"
                      className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-4 px-6 font-medium"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Persona
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Knowledge Tab */}
                <TabsContent value="knowledge" className="p-6 space-y-6">
                  <div>
                    <Label htmlFor="knowledge-data" className="text-sm font-medium text-gray-700 mb-2 block">
                      Knowledge Content
                    </Label>
                    <Textarea
                      id="knowledge-data"
                      value={knowledgeData}
                      onChange={(e) => setKnowledgeData(e.target.value)}
                      placeholder="Enter the knowledge content you want to add to the agent..."
                      className="min-h-32 border-gray-300 focus:border-orange-500 focus:ring-orange-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Add information that your agent should know and reference in conversations.
                    </p>
                  </div>
                  <Button onClick={queueKnowledge} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10">
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Queue
                  </Button>
                </TabsContent>

                {/* Action Tab */}
                <TabsContent value="action" className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Trigger Type</Label>
                      <Select value={triggerType} onValueChange={setTriggerType}>
                        <SelectTrigger className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="Select trigger" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="talks-about">User Talks About</SelectItem>
                          <SelectItem value="sentiment">User Sentiment Is</SelectItem>
                          <SelectItem value="ask-about">User Asks About</SelectItem>
                          <SelectItem value="conversation-start">Conversation Starts</SelectItem>
                          <SelectItem value="intention">User Wants To</SelectItem>
                          <SelectItem value="provides">User Provides</SelectItem>
                          <SelectItem value="sentence-contains">User Sentence Contains</SelectItem>
                          <SelectItem value="date-time">The Date Is</SelectItem>
                          <SelectItem value="url-contains">Page URL Contains</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Action Type</Label>
                      <Select value={actionType} onValueChange={setActionType}>
                        <SelectTrigger className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="talk-about">Talk About</SelectItem>
                          <SelectItem value="say-exact-message">Say Exact Message</SelectItem>
                          <SelectItem value="collect-value">Ask For Information</SelectItem>
                          <SelectItem value="always-include">Always Include</SelectItem>
                          <SelectItem value="always-talk-about">Always Talk About</SelectItem>
                          <SelectItem value="fill-form">Fill Form</SelectItem>
                          <SelectItem value="show-button">Show Button</SelectItem>
                          <SelectItem value="send-email">Send Email</SelectItem>
                          <SelectItem value="send-api-request">Send API Request</SelectItem>
                          <SelectItem value="search-in-website">Search In Website</SelectItem>
                          <SelectItem value="show-video">Show Video</SelectItem>
                          <SelectItem value="use-knowledge-base">Use Knowledge Base</SelectItem>
                          <SelectItem value="show-screen-share-button">Show Screen Share Button</SelectItem>

                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {triggerType !== "conversation-start" && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Trigger Value</Label>
                      <Input
                        value={triggerValue}
                        onChange={(e) => setTriggerValue(e.target.value)}
                        placeholder="Enter trigger value"
                        className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                  )}

                  {actionType === "fill-form" && (
                    <div>
                      <Label>Select Form</Label>
                      <Select value={actionValue as string} onValueChange={setActionValue}>
                        <SelectTrigger>
                          <SelectValue placeholder={forms.length ? "Select a form" : "Loading forms…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {actionType === "show-button" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Button Text</Label>
                        <Input value={actionButtonText} onChange={e => setActionButtonText(e.target.value)} placeholder="e.g. Visit Website" />
                      </div>
                      <div>
                        <Label>Button URL</Label>
                        <Input value={actionButtonUrl} onChange={e => setActionButtonUrl(e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                  )}
                  {actionType === "send-email" && (
                    <div className="space-y-4">
                      <div><Label>Email Subject</Label><Input value={actionEmailSubject} onChange={e => setActionEmailSubject(e.target.value)} /></div>
                      <div><Label>Email Content (HTML)</Label><Textarea value={actionEmailContent} onChange={e => setActionEmailContent(e.target.value)} /></div>
                      <div><Label>Sender Name</Label><Input value={actionEmailSender} onChange={e => setActionEmailSender(e.target.value)} /></div>
                      <div><Label>Reply-To Email</Label><Input value={actionEmailReplyTo} onChange={e => setActionEmailReplyTo(e.target.value)} /></div>
                      <div><Label>Recipient Email</Label><Input value={actionEmailRecipient} onChange={e => setActionEmailRecipient(e.target.value)} /></div>
                    </div>
                  )}
                  {actionType === "send-api-request" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Method</Label>
                        <Select value={actionApiMethod} onValueChange={setActionApiMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Endpoint URL</Label><Input value={actionApiEndpoint} onChange={e => setActionApiEndpoint(e.target.value)} /></div>
                    </div>
                  )}
                  {actionType === "search-in-website" && (
                    <div className="space-y-4">
                      <div><Label>Website URL</Label><Input value={actionWebsiteUrl} onChange={e => setActionWebsiteUrl(e.target.value)} /></div>
                      <div><Label>Search For</Label><Input value={actionWebsiteSearchFor} onChange={e => setActionWebsiteSearchFor(e.target.value)} /></div>
                    </div>
                  )}
                  {actionType === "show-video" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Platform</Label>
                        <Select value={actionVideoPlatform} onValueChange={setActionVideoPlatform}>
                          <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="YouTube">YouTube</SelectItem>
                            <SelectItem value="Vimeo">Vimeo</SelectItem>
                            <SelectItem value="23 Video">23 Video</SelectItem>
                            <SelectItem value="Loom Video Embed">Loom Video</SelectItem>
                            <SelectItem value="Animoto">Animoto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Video URL</Label><Input value={actionVideoUrl} onChange={e => setActionVideoUrl(e.target.value)} /></div>
                    </div>
                  )}
                  {actionType === "use-knowledge-base" && (
                    <div>
                      <Label>Select Knowledge Base</Label>
                      <Select value={actionValue as string} onValueChange={setActionValue}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={knowledgeBases.length ? "Select a knowledge base" : "Loading knowledge bases…"}
                            // This ensures the label is shown for the selected value
                          >
                            {
                              knowledgeBases.find(kb => kb.uuid === actionValue)?.title || ""
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {knowledgeBases.map((kb, idx) => (
                            <SelectItem key={`${kb.uuid}-${idx}`} value={kb.uuid}>
                              {kb.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {actionType === "show-screen-share-button" && (
                    <p>No additional settings required for screen-share button.</p>
                  )}
                  {!["fill-form","show-button","send-email","send-api-request","search-in-website","show-video","use-knowledge-base","show-screen-share-button"].includes(actionType) && (
                    <div>
                      <Label>Action Value</Label>
                      <Input value={actionValue as string} onChange={e => setActionValue(e.target.value)} placeholder="Enter action value" />
                    </div>
                  )}

                  <Button onClick={queueAction} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10">
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Queue
                  </Button>
                </TabsContent>

                {/* Persona Tab */}
                <TabsContent value="persona" className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Property</Label>
                      <Select value={personaProperty} onValueChange={setPersonaProperty}>
                        <SelectTrigger className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="language">Language</SelectItem>
                          <SelectItem value="tone">Tone</SelectItem>
                          <SelectItem value="chattiness">Chattiness</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {personaValueOptions.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">Value</Label>
                        <Select value={personaValue} onValueChange={setPersonaValue}>
                          <SelectTrigger className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {personaValueOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Agent Name</Label>
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Enter agent name"
                      className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Agent Role</Label>
                    <Input
                      value={agentRole}
                      onChange={(e) => setAgentRole(e.target.value)}
                      placeholder="Enter agent role"
                      className="h-10 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Chat Guideline</Label>
                    <Textarea
                      value={newGuideline}
                      onChange={(e) => setNewGuideline(e.target.value)}
                      placeholder="Enter a new guideline for the agent"
                      className="min-h-20 border-gray-300 focus:border-orange-500 focus:ring-orange-500 resize-none"
                    />
                  </div>

                  <Button onClick={queuePersona} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10">
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Queue
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Queued Operations */}
          {queuedOps.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium text-gray-900">Pending Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {queuedOps.map((op) => (
                    <div key={op.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            op.type === "knowledge" && "border-blue-200 text-blue-700 bg-blue-50",
                            op.type === "action" && "border-green-200 text-green-700 bg-green-50",
                            op.type === "persona" && "border-purple-200 text-purple-700 bg-purple-50",
                          )}
                        >
                          {op.type}
                        </Badge>
                        <span className="text-sm text-gray-700">{op.description}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteQueuedOperation(op.id)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Apply Button */}
          <Button
            onClick={executeBatch}
            disabled={queuedOps.length === 0 || isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying Changes...
              </>
            ) : (
              `Apply ${queuedOps.length} Change${queuedOps.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm h-full">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-orange-500" />
                  Live Preview
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={closeChat} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0 h-[600px]">
                {chatId && config && (
                  <iframe
                    src={`https://www.jotform.com/agent/${agentId}/view/${chatId}?apiKey=${config.jotformApiKey}`}
                    className="w-full h-full border-0 rounded-b-lg"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
