"use client"

import { useState, useRef, useEffect } from "react"

interface LiveChatPreviewProps {
  agentId: string
  chatId: string
  apiKey: string
  maxReloads?: number
}

export default function LiveChatPreview({ agentId, chatId, apiKey, maxReloads }: LiveChatPreviewProps) {
  const [showA, setShowA] = useState(true)
  const [reloadCount, setReloadCount] = useState(0)
  const iframeA = useRef<HTMLIFrameElement>(null)
  const iframeB = useRef<HTMLIFrameElement>(null)

  // initial load: warm up both iframes
  const baseSrc = chatId
    ? `https://www.jotform.com/agent/${agentId}/view/${chatId}?apiKey=${apiKey}`
    : ""

  // set starting src for both iframes
  useEffect(() => {
    if (iframeA.current) iframeA.current.src = baseSrc
    if (iframeB.current) iframeB.current.src = baseSrc
  }, [baseSrc])

  // double-buffer reload loop
  useEffect(() => {
    const iv = setInterval(() => {
      // Stop if we've hit or exceeded the expected reloads
      if (typeof maxReloads === "number" && reloadCount >= maxReloads) {
        clearInterval(iv)
        return
      }

      const nextSrc =
        `https://www.jotform.com/agent/${agentId}/view/${chatId}` +
        `?apiKey=${apiKey}&ts=${Date.now()}`

      const hiddenIfr = showA ? iframeB.current! : iframeA.current!

      hiddenIfr.onload = () => {
          // figure out how many reloads we'll have done after this one
        const nextCount = reloadCount + 1
        // always bump the count
        setReloadCount(nextCount)
        // if this *is* the last reload, bail out here—don't swap to the buffer
        if (typeof maxReloads === "number" && nextCount >= maxReloads) {
            return
        }
        // otherwise scroll & swap as normal
        try {
            hiddenIfr.contentWindow?.scrollTo(
            0,
            hiddenIfr.contentWindow!.document.body.scrollHeight
            )
        } catch {}
        setShowA(prev => !prev)
        // else: do nothing, so we stay on the final iframe
      }

      hiddenIfr.src = nextSrc
    }, 2000)

    return () => clearInterval(iv)
  }, [agentId, chatId, apiKey, showA, reloadCount, maxReloads])

  // finalization: ensure correct iframe is visible after last reload
  useEffect(() => {
    if (typeof maxReloads !== "number" || reloadCount < maxReloads) return
    const finalShowA = maxReloads % 2 == 0
    setShowA(finalShowA)
    const finalIfr = finalShowA ? iframeA.current! : iframeB.current!
    try {
      finalIfr.contentWindow!.scrollTo(
        0,
        finalIfr.contentWindow!.document.body.scrollHeight
      )
    } catch {}
  }, [reloadCount, maxReloads])

  return (
    <div className="relative w-full h-screen">
      <iframe
        ref={iframeA}
        src={baseSrc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className={`absolute inset-0 w-full h-full border-0 rounded-b-lg transition-opacity duration-300 ${
          showA ? "opacity-100" : "opacity-0"
        }`}
      />
      <iframe
        ref={iframeB}
        src={baseSrc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className={`absolute inset-0 w-full h-full border-0 rounded-b-lg transition-opacity duration-300 ${
          showA ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  )
}
