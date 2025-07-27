"use client";

import { useState, useRef, useEffect } from "react";

interface LiveChatPreviewProps {
  agentId: string;
  chatId: string;
  apiKey: string;
  maxReloads?: number;
}

export default function LiveChatPreview({
  agentId,
  chatId,
  apiKey,
  maxReloads,
}: LiveChatPreviewProps) {
  const [showA, setShowA] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);
  const iframeA = useRef<HTMLIFrameElement>(null);
  const iframeB = useRef<HTMLIFrameElement>(null);

  const baseSrc = chatId
    ? `https://www.jotform.com/agent/${agentId}/view/${chatId}?apiKey=${apiKey}`
    : "";

  // Initially load both iframes once
  useEffect(() => {
    if (iframeA.current) iframeA.current.src = baseSrc;
    if (iframeB.current) iframeB.current.src = baseSrc;
  }, [baseSrc]);

  useEffect(() => {
    if (!baseSrc) return;

    let active = true;
    let currentReloadCount = 0;
    let showIframeA = true; // always keep local state fresh inside the closure

    const interval = setInterval(() => {
      if (typeof maxReloads === "number" && currentReloadCount >= maxReloads) {
        clearInterval(interval);
        return;
      }

      const hiddenIframe = showIframeA ? iframeB.current : iframeA.current;
      if (!hiddenIframe) return;

      const nextSrc = `${baseSrc}&ts=${Date.now()}`;

      hiddenIframe.onload = () => {
        if (!active) return;

        currentReloadCount += 1;
        setReloadCount(currentReloadCount);

        // Scroll down to latest content
        try {
          hiddenIframe.contentWindow?.scrollTo(
            0,
            hiddenIframe.contentWindow.document.body.scrollHeight
          );
        } catch {}

        // Swap visibility only after load completes
        showIframeA = !showIframeA;
        setShowA(showIframeA);

        // If we've reached the limit, ensure visible iframe is correct
        if (typeof maxReloads === "number" && currentReloadCount >= maxReloads) {
          const finalIframe = showIframeA ? iframeA.current : iframeB.current;
          try {
            finalIframe?.contentWindow?.scrollTo(
              0,
              finalIframe.contentWindow.document.body.scrollHeight
            );
          } catch {}
          clearInterval(interval);
        }
      };

      // trigger reload
      hiddenIframe.src = nextSrc;
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [baseSrc, agentId, chatId, apiKey, maxReloads]);

  return (
    <div className="relative w-full h-screen">
      <iframe
        ref={iframeA}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className={`absolute inset-0 w-full h-full border-0 rounded-b-lg transition-opacity duration-300 ${
          showA ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      />
      <iframe
        ref={iframeB}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className={`absolute inset-0 w-full h-full border-0 rounded-b-lg transition-opacity duration-300 ${
          showA ? "opacity-0 z-0" : "opacity-100 z-10"
        }`}
      />
    </div>
  );
}