"use client"

import { useEffect, useState } from "react"

// Shown on the landing page after "Delete my account" signs the user out to /?deleted=1.
export function DeletedNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("deleted") === "1") {
      setShow(true)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])
  if (!show) return null
  return (
    <div role="status" className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
      Your account and all your data have been deleted. Thanks for trying ReWork.
    </div>
  )
}
