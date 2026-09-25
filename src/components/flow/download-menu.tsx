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
import type { ApplicationDetailDTO } from "./api"
import { primaryButtonClass } from "./ui"

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
}: {
  application: ApplicationDetailDTO
  template: TemplateId
  className?: string
  label?: string
}) {
  const links = downloadLinks(application, template)
  const hasLetter = !!application.coverLetter
  const item = "cursor-pointer text-slate-200 focus:bg-white/10 focus:text-white"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(primaryButtonClass, className)}>
        <Download className="h-4 w-4" /> {label} <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-white/10 bg-slate-900 text-slate-200">
        <DropdownMenuLabel className="text-xs font-normal text-slate-400">PDF for humans, Word for application portals.</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-500">Resume</DropdownMenuLabel>
        <DropdownMenuItem asChild className={item}>
          <a href={links.resumePdf}>
            <FileText className="mr-2 h-4 w-4" /> Resume PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={item}>
          <a href={links.resumeDocx}>
            <FileType className="mr-2 h-4 w-4" /> Resume Word (.docx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-500">Cover letter</DropdownMenuLabel>
        {hasLetter ? (
          <>
            <DropdownMenuItem asChild className={item}>
              <a href={links.letterPdf}>
                <FileText className="mr-2 h-4 w-4" /> Cover letter PDF
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={item}>
              <a href={links.letterDocx}>
                <FileType className="mr-2 h-4 w-4" /> Cover letter Word (.docx)
              </a>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled className="text-xs text-slate-500">
            Write one in the Cover letter tab first
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
