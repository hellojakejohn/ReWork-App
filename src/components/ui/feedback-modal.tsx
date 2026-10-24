'use client'

import React from 'react'
import { useFeedback, FeedbackType } from '@/contexts/feedback-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquare, Bug, Lightbulb, Send, ExternalLink } from 'lucide-react'

const feedbackTypeOptions = [
  {
    value: 'BUG_REPORT' as FeedbackType,
    label: 'Bug Report',
    icon: Bug,
    description: 'Something isn\'t working correctly',
  },
  {
    value: 'FEATURE_REQUEST' as FeedbackType,
    label: 'Feature Request',
    icon: Lightbulb,
    description: 'Suggest a new feature or improvement',
  },
  {
    value: 'GENERAL_FEEDBACK' as FeedbackType,
    label: 'General Feedback',
    icon: MessageSquare,
    description: 'Share your thoughts about the app',
  },
]

export const FeedbackModal: React.FC = () => {
  const {
    isOpen,
    closeModal,
    formData,
    setFormData,
    isSubmitting,
    submitFeedback,
  } = useFeedback()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitFeedback()
  }

  const selectedOption = feedbackTypeOptions.find(option => option.value === formData.type)

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Header */}
        <DialogHeader className="text-center">
          <div className="w-16 h-16 bg-sage rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-text" />
          </div>
          <DialogTitle className="text-2xl text-text">Quick feedback</DialogTitle>
          <p className="text-text-muted mt-2">
            Tell us what worked and what didn’t. We read every note.
          </p>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Feedback Type */}
          <div className="space-y-2">
            <Label htmlFor="feedback-type" className="text-text font-medium">
              What type of feedback do you have?
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: FeedbackType) => setFormData({ type: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                {feedbackTypeOptions.map((option) => {
                  const IconComponent = option.icon
                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                                          >
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-text-muted">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-text font-medium">
              Message *
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ message: e.target.value })}
              placeholder="Tell us what happened or what you'd like to see..."
              className="min-h-[120px] resize-none"
              required
            />
            <div className="text-xs text-text-muted">
              {formData.message.length}/2000 characters
            </div>
          </div>

          {/* Email (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-text font-medium">
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ email: e.target.value })}
              placeholder="your@email.com (optional)"
              
            />
            <div className="text-xs text-text-muted">
              Leave empty to submit anonymously
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.message.trim()}
              className="w-full"
              loading={isSubmitting}
            >
              {!isSubmitting && <Send className="w-4 h-4" />}
              {isSubmitting ? "Sending..." : "Send feedback"}
            </Button>

            <Button
              type="button"
              variant="text"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>

          {/* Footer Link */}
          <div className="pt-4 border-t border-border text-center">
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => window.open('https://reworksolutions.canny.io/', '_blank', 'noopener,noreferrer')}
            >
              <span>View feature roadmap</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default FeedbackModal