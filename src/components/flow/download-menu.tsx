"use client"

// Result card download menu: resume and cover letter, each as PDF or Word.
import { ChevronDown, Download, FileText, FileType } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TemplateId } from "@/lib/resume-templates"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORD_EXPORT_UPSELL } from "@/lib/plans"
import type { ApplicationDetailDTO } from "./api"
import { buttonVariants } from "@/components/ui/button"

export function downloadLinks(application: ApplicationDetailDTO, template: TemplateId) {
  const resume = `/api/resumes/${application.resumeId}/download?applicationId=${application.id}&template=${template}`
  const letter = `/api/resumes/applications/${application.id}/cover-letter/download?template=${template}`
  return {
    resumePdf: resume,
    resumeDocx: `${resume}&format=docx`,
    letterPdf: `${letter}&format=pdf`,
    letterDocx: `${letter}&format=docx`,
  }
}

export function DownloadMenu({
  application,
  template,
  className,
  label = "Download",
  isPro,
  onUpgrade,
}: {
  application: ApplicationDetailDTO
  template: TemplateId
  className?: string
  label?: string
  isPro: boolean
  onUpgrade: (reason: string) => void
}) {
  const links = downloadLinks(application, template)
  const hasLetter = !!application.coverLetter
  const item = "cursor-pointer"
  // Word is Pro: FREE sees the option with a badge that opens the upgrade sheet.
  const word = (href: string, text: string) =>
    isPro ? (
      <DropdownMenuItem asChild className={item}>
        <a href={href}>
          <FileType className="mr-2 h-4 w-4" /> {text}
        </a>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem className={item} onSelect={() => onUpgrade(WORD_EXPORT_UPSELL)}>
        <FileType className="mr-2 h-4 w-4" /> {text}
        <span className="ml-auto rounded-full bg-sage px-1.5 text-xs font-semibold text-text">Pro</span>
      </DropdownMenuItem>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "inverse" }), className)}>
        <Download className="h-4 w-4" /> {label} <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-text-muted">PDF for humans, Word for application portals.</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-text-muted">Resume</DropdownMenuLabel>
        <DropdownMenuItem asChild className={item}>
          <a href={links.resumePdf}>
            <FileText className="mr-2 h-4 w-4" /> Resume PDF
          </a>
        </DropdownMenuItem>
        {word(links.resumeDocx, "Resume Word (.docx)")}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-text-muted">Cover letter</DropdownMenuLabel>
        {hasLetter ? (
          <>
            <DropdownMenuItem asChild className={item}>
              <a href={links.letterPdf}>
                <FileText className="mr-2 h-4 w-4" /> Cover letter PDF
              </a>
            </DropdownMenuItem>
            {word(links.letterDocx, "Cover letter Word (.docx)")}
          </>
        ) : (
          <DropdownMenuItem disabled className="text-xs text-text-muted">
            Write one in the Cover letter tab first
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
