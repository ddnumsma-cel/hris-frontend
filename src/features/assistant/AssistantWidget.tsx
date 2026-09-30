import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRightIcon, XIcon } from "@/components/icons";
import { answerLocally } from "./localAssistant";
import { useAssistantData } from "./useAssistantData";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

function SparkleIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" fill="currentColor" />
    </svg>
  );
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = useAssistantData();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  function send() {
    const text = input.trim();
    if (!text || thinking) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setThinking(true);

    // Small artificial delay so it reads as "thinking" rather than an
    // instant lookup snapping into place.
    setTimeout(() => {
      const reply = answerLocally(text, data);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setThinking(false);
    }, 350);
  }

  return (
    <>
      <button
        type="button"
        data-tour="assistant-button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-5 right-5 z-90 flex h-13 w-13 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform active:scale-95"
      >
        {open ? <XIcon className="h-5 w-5" /> : <SparkleIcon className="h-5.5 w-5.5" />}
      </button>

      {open && (
        <div data-assistant-panel className="panel-enter fixed bottom-21 right-5 z-90 flex h-[min(560px,70vh)] w-[min(380px,92vw)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border bg-brand-dark px-4 py-3 text-white">
            <SparkleIcon className="h-4 w-4 text-[#8fc93f]" />
            <div>
              <div className="text-sm font-semibold">MSMA Assistant</div>
              <div className="text-[0.68rem] text-white/60">Reads your real data · no external AI, no cost</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-ink-2">
                <SparkleIcon className="h-6 w-6 text-brand-ink" />
                <p className="text-sm">
                  Ask me about your leave balance, payslips, attendance, or other things already in this system.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={clsx(
                    "max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm",
                    m.role === "user" ? "self-end bg-brand text-white" : "self-start bg-surface-2 text-ink",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1 self-start rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3" />
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something…"
              disabled={thinking}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send message"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
