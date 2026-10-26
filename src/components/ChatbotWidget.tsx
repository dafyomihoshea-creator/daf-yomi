import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { numberToHebrewDaf } from "@/lib/masechet-list";
import { MessageSquare, X, Send, Sparkles, Loader2, BookOpen, Clock, LogIn, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseMasechetAndDaf } from "../../server/sefaria";
import type { ChatScope, ChatSource } from "../../server/ai";

/** "12:30" or "1:02:03" → seconds. */
const toSeconds = (t: string) => t.split(":").reduce((s, p) => s * 60 + (parseInt(p, 10) || 0), 0);

interface Message {
  role: "user" | "assistant";
  content: string;
  masechet?: string;
  daf?: number;
  youtubeId?: string;
  videoTitle?: string;
  sources?: Record<string, ChatSource>;
  /** The question waiting for the visitor to choose where to look. */
  askScope?: { question: string; masechet: string | null };
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { lang, dir } = useLanguage();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, signIn } = useAuth();
  const [scope, setScope] = useState<ChatScope | null>(null);

  // Detect if we are on a specific lesson page
  const lessonMatch = location.pathname.match(/\/lesson\/([^/]+)/);
  const currentYoutubeId = lessonMatch ? lessonMatch[1] : null;

  // Active lesson context details if we can fetch them
  const [currentLesson, setCurrentLesson] = useState<{
    youtubeId: string;
    title?: string;
    masechet?: string;
    daf?: number;
  } | null>(null);

  // A new lesson page: ask again where to look.
  useEffect(() => { setScope(null); }, [currentYoutubeId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Fetch current lesson info if we are on a lesson page
  useEffect(() => {
    let active = true;
    if (currentYoutubeId) {
      supabase
        .from("videos")
        .select("title, masechet, daf")
        .eq("youtube_id", currentYoutubeId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!active) return;
          if (data && !error) {
            setCurrentLesson({
              youtubeId: currentYoutubeId,
              title: data.title || undefined,
              masechet: data.masechet || undefined,
              daf: data.daf || undefined,
            });
          } else {
            setCurrentLesson({ youtubeId: currentYoutubeId });
          }
        })
        .catch(() => {
          if (active) setCurrentLesson({ youtubeId: currentYoutubeId });
        });
    } else {
      setCurrentLesson(null);
    }
    return () => {
      active = false;
    };
  }, [currentYoutubeId]);

  const scopeLabel = (s: ChatScope, masechet?: string | null) =>
    s === "lesson" ? "השיעור הזה" : s === "masechet" ? `כל מסכת ${masechet || currentLesson?.masechet || ""}` : "כל הש״ס";

  const handleSendMessage = async (textToSend?: string, chosenScope?: ChatScope) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || isLoading || !user) return;

    if (!textToSend) setInput("");

    const userMsg: Message = { role: "user", content: messageText };
    // First make sure where the question is about: this lesson, the tractate, or the whole Shas.
    const useScope = chosenScope || scope;
    if (!useScope) {
      const asked = parseMasechetAndDaf(messageText).masechet;
      setMessages(prev => [...prev, userMsg, {
        role: "assistant",
        content: "לפני שאחפש תשובה בשיעורי הרב — על מה השאלה?",
        askScope: { question: messageText, masechet: asked || currentLesson?.masechet || null },
      }]);
      return;
    }
    const updatedMessages = chosenScope ? messages.filter(m => !m.askScope) : [...messages, userMsg];
    setMessages(updatedMessages);
    setScope(useScope);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          scope: useScope,
          history: updatedMessages.slice(0, -1).filter((m) => !m.askScope).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentLesson: currentLesson,
        }),
      });

      if (!response.ok) {
        let errorMsg = "Failed to query chatbot";
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer,
        masechet: data.masechet,
        daf: data.daf,
        youtubeId: data.youtubeId,
        videoTitle: data.videoTitle,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error("Chatbot Error:", error);
      const isQuotaOrTech = error?.message && (
        error.message.includes("Quota exceeded") ||
        error.message.includes("מכסה") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("429")
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isQuotaOrTech
            ? (lang === "he"
                ? "מערכת ה-AI עמוסה כרגע. תוכל להמשיך לעיין בביאור שטיינזלץ המלא ובתמלול השיעור המופיע בעמוד, או לנסות שוב בעוד מספר רגעים."
                : "The AI system is busy right now. You can consult the Steinsaltz commentary and transcript on this page.")
            : (error?.message && error.message !== "Failed to query chatbot"
                ? error.message
                : (lang === "he"
                  ? "מצטער, חלה שגיאה בתקשורת עם שרת ה-AI. אנא נסה שוב בעוד מספר רגעים."
                  : "Sorry, an error occurred while connecting to the AI server. Please try again in a few moments."))
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Quick suggestions based on language
  const suggestions =
    lang === "he"
      ? [
          "על מה מדבר הדף הנוכחי?",
          "הסבר לי את הסוגיה במילים פשוטות",
          "מה הרב הושע מסביר על עיקרי הדף?",
        ]
      : [
          "What is this page discussing?",
          "Explain the topic in simple terms",
          "What does Rabbi Hoshea explain?",
        ];

  /** A citation [[L1@12:30]] → a link that opens that lesson at that minute. */
  const renderCitations = (text: string, sources: Record<string, ChatSource> | undefined, key: string | number) =>
    text.split(/(\[\[L\d+@[^\]]+\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(L\d+)@([^\]]+)\]\]$/);
      if (!m) return part;
      const src = sources?.[m[1]];
      if (!src) return null;
      const here = src.youtubeId === currentLesson?.youtubeId;
      // Usually one time; the AI sometimes writes "2:08-5:17" or "17:35, 19:32" — link each one.
      const times = m[2].match(/\d+(?::\d{1,2}){1,2}/g) || [];
      return times.map((t, j) => (
        <Link
          key={`${key}-${i}-${j}`}
          to={`/lesson/${src.youtubeId}?t=${toSeconds(t)}`}
          className="inline-flex items-center gap-0.5 mx-0.5 text-[11px] text-accent hover:underline bg-accent/10 px-1.5 rounded align-baseline"
          title={src.title}
        >
          <Clock className="h-2.5 w-2.5" />
          <span dir="ltr">{t}</span>
          {!here && src.masechet && <span>· {src.masechet}{src.daf ? ` ${numberToHebrewDaf(src.daf)}` : ""}</span>}
        </Link>
      ));
    });

  // Simple text formatting for bolding (**text**), bullet points (- text) and lesson citations
  const formatMessageText = (text: string, sources?: Record<string, ChatSource>) => {
    const lines = text.split("\n");
    return lines.map((line, index) => {
      const isListItem = line.trim().startsWith("-") || line.trim().startsWith("*");
      let content = line;
      if (isListItem) {
        content = line.trim().substring(1).trim();
      }

      const parts = content.split(/(\*\*.*?\*\*)/g);
      const formattedContent = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={pIdx} className="font-bold text-foreground">
              {renderCitations(part.slice(2, -2), sources, `${index}-${pIdx}`)}
            </strong>
          );
        }
        return renderCitations(part, sources, `${index}-${pIdx}`);
      });

      if (isListItem) {
        return (
          <li key={index} className="list-disc list-inside mr-2 my-1 font-body text-sm leading-relaxed">
            {formattedContent}
          </li>
        );
      }

      return (
        <p key={index} className="my-1 font-body text-sm leading-relaxed min-h-[0.75rem]">
          {formattedContent}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start font-body" dir={dir}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-96 max-w-[calc(100vw-2rem)] h-[550px] max-h-[85vh] flex flex-col shadow-2xl rounded-2xl border border-border bg-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-accent/10 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent animate-pulse" />
                <div>
                  <h3 className="font-display font-bold text-sm text-foreground">
                    {lang === "he" ? "חברותא AI • עוזר הלימוד" : "Chavruta AI • Study Assistant"}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    {lang === "he" ? "תשובות מתוך שיעורי הרב הושע, עם הפניה לדקה בשיעור" : "Answers from Rabbi Hoshea's lessons, with the minute"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Current Lesson Context Badge */}
            {currentLesson && (
              <div className="px-4 py-2 bg-accent/5 border-b border-border text-[11px] text-accent flex items-center gap-1.5 font-medium">
                <BookOpen className="h-3 w-3" />
                <span>
                  {lang === "he"
                    ? `מחובר להקשר של מסכת ${currentLesson.masechet || ""} דף ${
                        currentLesson.daf ? numberToHebrewDaf(currentLesson.daf) : ""
                      }`
                    : `Connected to Masechet ${currentLesson.masechet || ""} Page ${currentLesson.daf || ""}`}
                </span>
              </div>
            )}

            {/* Where the answers come from (chosen with the first question) */}
            {user && scope && (
              <div className="px-4 py-1.5 border-b border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3 text-accent" />
                <span>{lang === "he" ? `מחפש ב: ${scopeLabel(scope)}` : `Searching: ${scope}`}</span>
                <button className="mr-auto text-accent hover:underline" onClick={() => setScope(null)}>
                  {lang === "he" ? "שנה" : "Change"}
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-zinc-950/20">
              {!user && (
                <div className="text-center py-10 px-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                    <LogIn className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground">
                      {lang === "he" ? "חברותא AI זמין למשתמשים רשומים" : "Chavruta AI is for registered users"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "he"
                        ? "התחבר עם חשבון Google (בחינם) כדי לשאול שאלות על שיעורי הרב ולקבל תשובות עם הפניה לדקה המדויקת בשיעור."
                        : "Sign in with Google (free) to ask about the lessons and get answers with the exact minute in the lesson."}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => signIn().catch(() => {})} className="gap-1.5">
                    <LogIn className="h-4 w-4" />
                    {lang === "he" ? "התחברות / הרשמה" : "Sign in / Register"}
                  </Button>
                </div>
              )}

              {user && messages.length === 0 && (
                <div className="text-center py-8 px-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground">
                      {lang === "he" ? "איך אוכל לעזור בלימוד היום?" : "How can I help with your study today?"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "he"
                        ? "שאל אותי על סוגיות הגמרא, מונחים קשים, או נקודות שהרב הושע העלה בשיעור!"
                        : "Ask about Talmudic discussions, difficult terms, or points raised by Rabbi Hoshea!"}
                    </p>
                  </div>

                  {/* Suggestion Prompts */}
                  <div className="pt-2 space-y-2">
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(sug)}
                        className="w-full text-right p-2.5 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-accent/30 text-xs transition-colors font-body text-foreground/80 flex items-center justify-between group"
                      >
                        <span>{sug}</span>
                        <Sparkles className="h-3.5 w-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground rounded-br-none"
                        : "bg-card border border-border text-foreground rounded-bl-none"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="whitespace-pre-line">{formatMessageText(msg.content, msg.sources)}</div>

                      {msg.askScope && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          {([
                            ...(currentLesson ? ["lesson"] : []),
                            ...(msg.askScope.masechet ? ["masechet"] : []),
                            "shas",
                          ] as ChatScope[]).map(s => (
                            <button
                              key={s}
                              onClick={() => handleSendMessage(msg.askScope!.question, s)}
                              disabled={isLoading}
                              className="w-full text-right px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/15 text-xs text-foreground flex items-center gap-1.5"
                            >
                              <Search className="h-3 w-3 text-accent" />
                              {scopeLabel(s, msg.askScope!.masechet)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Source attribution / helper badge */}
                      {msg.role === "assistant" && msg.masechet && msg.daf && (
                        <div className="pt-2 border-t border-border/40 mt-2 flex flex-wrap gap-1.5">
                          <Link
                            to={`/masechet/${msg.masechet}`}
                            className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline bg-accent/5 px-2 py-0.5 rounded"
                          >
                            <BookOpen className="h-2.5 w-2.5" />
                            <span>
                              {msg.masechet} דף {numberToHebrewDaf(msg.daf)}
                            </span>
                          </Link>
                          {msg.youtubeId && (
                            <Link
                              to={`/lesson/${msg.youtubeId}`}
                              className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline bg-accent/5 px-2 py-0.5 rounded"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              <span>{lang === "he" ? "צפה בשיעור" : "Watch Lesson"}</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border text-muted-foreground rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    <span className="text-xs">{lang === "he" ? "חברותא AI חושב..." : "Chavruta AI is thinking..."}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input */}
            <div className="p-3 bg-card border-t border-border flex items-center gap-2">
              <Input
                placeholder={lang === "he" ? "שאל משהו על הלימוד..." : "Ask something about the study..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !user}
                className="flex-1 font-body text-sm"
              />
              <Button
                size="icon"
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading || !user}
                className="h-9 w-9 rounded-xl shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 border border-accent-foreground/10"
        title={lang === "he" ? "צ'אט בוט חברותא AI" : "Chavruta AI Chatbot"}
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    </div>
  );
}
