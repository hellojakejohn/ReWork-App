"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FREE_PLAN_SUMMARY, FREE_TAILORS_PER_MONTH, PRO_PLAN_SUMMARY } from '@/lib/plans'

interface ChatMessage {
  id: string
  text: string
  isBot: boolean
  timestamp: Date
}

interface FAQ {
  id: string
  question: string
  answer: string
  category: 'general' | 'billing' | 'technical'
}

const FAQS: FAQ[] = [
  {
    id: '1',
    question: 'How do I upload a resume?',
    answer: 'Click the "Upload Resume" button on your dashboard, then drag and drop your PDF file or click to browse. We support PDF files up to 10MB.',
    category: 'general'
  },
  {
    id: '2',
    question: 'How does AI resume tailoring work?',
    answer: 'Our AI analyzes your resume and the job description, then optimizes your content to match the role requirements while keeping your authentic experience.',
    category: 'general'
  },
  {
    id: '3',
    question: 'What\'s the difference between Free and Pro?',
    answer: `Free: ${FREE_PLAN_SUMMARY}. Pro: ${PRO_PLAN_SUMMARY}.`,
    category: 'billing'
  },
  {
    id: '4',
    question: 'Can I download my resume as PDF?',
    answer: 'Yes! Click the download button on any resume or tailored version. Downloads are unlimited on every plan.',
    category: 'general'
  },
  {
    id: '5',
    question: 'Why is my resume upload failing?',
    answer: 'Make sure your file is a PDF under 10MB. If issues persist, try refreshing the page or clearing your browser cache.',
    category: 'technical'
  }
]

interface ChatBubbleProps {
  className?: string
}

export function ChatBubble({ className }: ChatBubbleProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasNotification, setHasNotification] = useState(false)
  const [isFirstOpen, setIsFirstOpen] = useState(true)
  const [showFAQs, setShowFAQs] = useState(true)

  useEffect(() => {
    // Show notification dot on first visit after login
    if (session?.user && !localStorage.getItem('chat-seen')) {
      setHasNotification(true)
    }

    const handleChatNotification = () => {
      setHasNotification(true)
    }

    window.addEventListener('show-chat-notification', handleChatNotification)
    return () => {
      window.removeEventListener('show-chat-notification', handleChatNotification)
    }
  }, [session])

  const addMessage = (text: string, isBot: boolean = false) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isBot,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleFAQClick = (faq: FAQ) => {
    // Add user question
    addMessage(faq.question, false)
    // Add bot answer after a short delay
    setTimeout(() => {
      addMessage(faq.answer, true)
      setShowFAQs(false) // Hide FAQs after first interaction
    }, 500)
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      addMessage(message, false)
      setMessage('')
      setShowFAQs(false) // Hide FAQs after user starts typing

      // Simple auto-response for common phrases
      setTimeout(() => {
        const lowerMessage = message.toLowerCase()
        let response = ''

        if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
          response = 'I\'m here to help! Check out our FAQ above or describe your specific issue.'
        } else if (lowerMessage.includes('upload') || lowerMessage.includes('pdf')) {
          response = 'For upload issues, make sure your file is a PDF under 10MB. Try refreshing if problems persist.'
        } else if (lowerMessage.includes('download') || lowerMessage.includes('limit')) {
          response = `Downloads are unlimited on every plan. Free includes ${FREE_TAILORS_PER_MONTH} tailored resumes per month; Pro is unlimited.`
        } else if (lowerMessage.includes('pricing') || lowerMessage.includes('cost')) {
          response = `Pro: ${PRO_PLAN_SUMMARY}. Free includes ${FREE_TAILORS_PER_MONTH} per month. See /pricing for details.`
        } else {
          response = 'Thanks for your message! Our team will get back to you soon. Check our FAQ above for instant answers.'
        }

        addMessage(response, true)
      }, 1000)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setHasNotification(false)
    setIsFirstOpen(false)
    localStorage.setItem('chat-seen', 'true')
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-card border border-border rounded-lg shadow-2xl backdrop-blur-sm animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-medium text-foreground">Support Chat</h3>
              <p className="text-xs text-muted-foreground">We're here to help</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 space-y-3 h-64 overflow-y-auto">
            {/* Welcome message */}
            <div className="bg-slate-800/50 p-3 rounded-lg text-sm border border-slate-700">
              <div className="font-medium text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                ReWork Support
              </div>
              <div className="text-slate-300">
                Hi! How can we help you today?
              </div>
            </div>

            {/* FAQ Quick Buttons */}
            {showFAQs && messages.length === 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 font-medium">Quick Help:</div>
                {FAQS.slice(0, 3).map((faq) => (
                  <button
                    key={faq.id}
                    onClick={() => handleFAQClick(faq)}
                    className="w-full text-left p-2 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700 hover:border-slate-600 rounded-md text-xs text-slate-300 transition-all"
                  >
                    {faq.question}
                  </button>
                ))}
                <button
                  onClick={() => setShowFAQs(false)}
                  className="text-xs text-slate-500 hover:text-slate-400 p-1"
                >
                  Show more options →
                </button>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    msg.isBot
                      ? 'bg-slate-800/50 border border-slate-700 text-slate-300'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {msg.isBot && (
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="text-xs font-medium text-slate-400">Support</span>
                    </div>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 resize-none bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                disabled={!message.trim()}
                className="px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send
            </p>
          </div>
        </div>
      )}

      {/* Chat Button */}
      {!isOpen && (
        <div className="relative">
          <Button
            onClick={handleOpen}
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>

          {/* Notification Dot */}
          {hasNotification && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background animate-pulse" />
          )}
        </div>
      )}
    </div>
  )
}