import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  ExternalLink, 
  Loader2, 
  RotateCw, 
  Columns, 
  Square,
  Maximize2,
  RefreshCw,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

// Configure PDFJS worker from unpkg aligned with the library version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FlipbookViewerProps {
  pdfUrl: string;
  title?: string;
  articleId?: string;
}

export function FlipbookViewer({ pdfUrl, title }: FlipbookViewerProps) {
  const { dir, lang } = useLanguage();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isDoublePage, setIsDoublePage] = useState<boolean>(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Hebrew translations
  const isHebrew = lang === "he" || dir === "rtl";
  const translations = useMemo(() => {
    return isHebrew ? {
      loading: "טוען מאמר...",
      loadError: "שגיאה בטעינת הקובץ. אנא ודא שהקובץ קיים או נסה שנית.",
      nextPage: "הדף הבא",
      prevPage: "הדף הקודם",
      pageOf: "מתוך",
      zoomIn: "הגדל",
      zoomOut: "הקטן",
      fitWidth: "התאם לרוחב",
      singlePage: "עמוד בודד",
      doublePage: "תצוגת ספר",
      openNewTab: "פתח בחלון חדש",
      download: "הורדה",
      retry: "נסה שנית",
      keyboardTip: "טיפ: ניתן לדפדף גם באמצעות מקשי החיצים ימינה ושמאלה",
    } : {
      loading: "Loading article...",
      loadError: "Error loading the document. Please verify the URL or try again.",
      nextPage: "Next Page",
      prevPage: "Previous Page",
      pageOf: "of",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      fitWidth: "Fit to Width",
      singlePage: "Single Page",
      doublePage: "Book View",
      openNewTab: "Open in new tab",
      download: "Download",
      retry: "Retry",
      keyboardTip: "Tip: Use Left/Right Arrow keys to navigate pages",
    };
  }, [isHebrew]);

  // Adjust double page mode if screen is too small
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && isDoublePage) {
        setIsDoublePage(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDoublePage]);

  // Reset page when document changes
  useEffect(() => {
    setCurrentPage(1);
    setLoading(true);
    setErrorStatus(null);
  }, [pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setErrorStatus(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF load error:", err);
    setErrorStatus(err.message || "Failed to load PDF");
    setLoading(false);
  };

  const handleNext = useCallback(() => {
    if (!numPages) return;
    const step = isDoublePage ? 2 : 1;
    if (currentPage + step <= numPages) {
      setDirection("forward");
      setCurrentPage(prev => Math.min(prev + step, numPages));
    }
  }, [numPages, isDoublePage, currentPage]);

  const handlePrev = useCallback(() => {
    const step = isDoublePage ? 2 : 1;
    if (currentPage - step >= 1) {
      setDirection("backward");
      setCurrentPage(prev => Math.max(prev - step, 1));
    }
  }, [isDoublePage, currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!numPages) return;
      
      const step = isDoublePage ? 2 : 1;
      
      // Hebrew reading mode swap (RTL):
      // Left arrow goes forward, Right arrow goes backward
      if (isHebrew) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleNext();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handlePrev();
        }
      } else {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          handleNext();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          handlePrev();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, currentPage, isDoublePage, isHebrew, handleNext, handlePrev]);

  const handlePageInput = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && numPages && num >= 1 && num <= numPages) {
      setDirection(num > currentPage ? "forward" : "backward");
      setCurrentPage(num);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.15, 2.5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.15, 0.6));
  };

  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48; // padding factor
      // Standard target size of A4 page rendered is ~600px width at scale 1
      const idealScale = isDoublePage 
        ? Math.max(0.6, (containerWidth / 2) / 600)
        : Math.max(0.6, containerWidth / 600);
      setScale(parseFloat(idealScale.toFixed(2)));
    }
  };

  // Motion variants for Hebrew book-like slider
  const pageTransitionVariants = {
    enter: (dir: "forward" | "backward") => ({
      x: isHebrew 
        ? (dir === "forward" ? -250 : 250) // Slide matching reading direction
        : (dir === "forward" ? 250 : -250),
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: "forward" | "backward") => ({
      x: isHebrew 
        ? (dir === "forward" ? 250 : -250)
        : (dir === "forward" ? -250 : 250),
      opacity: 0,
      scale: 0.98,
    }),
  };

  return (
    <div className="flex h-full w-full flex-col gap-3" dir={dir}>
      {/* Control Panel / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm select-none">
        
        {/* Page counter & Navigation (RTL/LTR Adaptive ordering) */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={isHebrew ? handleNext : handlePrev}
            disabled={loading || (isHebrew ? (currentPage >= (numPages || 1)) : (currentPage <= 1))}
            title={translations.prevPage}
            className="h-9 w-9"
          >
            {isHebrew ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          <div className="flex items-center gap-1.5 font-body text-sm text-foreground">
            <input 
              type="number"
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={(e) => handlePageInput(e.target.value)}
              className="w-12 bg-background border border-border rounded px-1.5 py-1 text-center font-bold font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              disabled={loading || !numPages}
            />
            <span className="text-muted-foreground">{translations.pageOf}</span>
            <span className="font-bold font-mono">{numPages || "?"}</span>
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={isHebrew ? handlePrev : handleNext}
            disabled={loading || (isHebrew ? (currentPage <= 1) : (currentPage >= (numPages || 1)))}
            title={translations.nextPage}
            className="h-9 w-9"
          >
            {isHebrew ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Zoom & Page layout settings */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Out */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomOut}
            disabled={loading || scale <= 0.6}
            title={translations.zoomOut}
            className="h-9 w-9"
          >
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
          </Button>

          {/* Zoom indicator percentage */}
          <span className="text-xs font-mono font-medium text-foreground min-w-[3.5rem] text-center">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomIn}
            disabled={loading || scale >= 2.5}
            title={translations.zoomIn}
            className="h-9 w-9"
          >
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </Button>

          {/* Fit to width */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleFitWidth}
            disabled={loading}
            title={translations.fitWidth}
            className="h-9 w-9"
          >
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Double Page / Book Layout Toggle (Visible on desktop) */}
          <div className="hidden lg:flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
            <Button
              variant={!isDoublePage ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setDirection("backward");
                setIsDoublePage(false);
              }}
              className="h-8 px-2.5 text-xs font-body"
              title={translations.singlePage}
            >
              <Square className="h-3.5 w-3.5 ml-1" />
              {translations.singlePage}
            </Button>
            <Button
              variant={isDoublePage ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setDirection("forward");
                setIsDoublePage(true);
                // Ensure we are on an odd page for authentic spreading, or matching bounds
                if (currentPage % 2 === 0 && currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
              className="h-8 px-2.5 text-xs font-body"
              title={translations.doublePage}
            >
              <Columns className="h-3.5 w-3.5 ml-1" />
              {translations.doublePage}
            </Button>
          </div>
        </div>

        {/* Actions Button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-body h-9 text-xs" asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              {translations.openNewTab}
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download={title || "article"}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Main Reader Stage */}
      <div 
        ref={containerRef}
        className="relative flex-1 min-h-[440px] w-full overflow-auto rounded-xl border border-border bg-neutral-900/95 scrollbar-thin shadow-inner p-6 flex flex-col items-center justify-start"
      >
        {/* User guide banner */}
        {numPages && (
          <div className="mb-4 text-[11px] text-zinc-400 font-body bg-zinc-800/80 px-3 py-1 rounded-full items-center gap-1.5 flex select-none max-w-full text-center">
            <BookOpen className="h-3.5 w-3.5 text-accent animate-pulse shrink-0" />
            <span>{translations.keyboardTip}</span>
          </div>
        )}

        <div className="flex-1 w-full flex items-center justify-center">
          {errorStatus ? (
            <div className="text-center p-8 max-w-md bg-zinc-800 rounded-xl border border-zinc-700 shadow-md">
              <p className="text-red-400 text-sm font-body mb-4">{translations.loadError}</p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" className="font-body text-zinc-200 border-zinc-600 hover:bg-zinc-700" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 ml-1.5" />
                  {translations.retry}
                </Button>
                <Button size="sm" className="font-body" asChild>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 ml-1.5" />
                    {translations.openNewTab}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center gap-3 p-8">
                  <Loader2 className="h-10 w-10 animate-spin text-accent" />
                  <p className="text-zinc-400 text-sm font-body">{translations.loading}</p>
                </div>
              }
              className="flex justify-center"
            >
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={`${currentPage}-${isDoublePage}`}
                  custom={direction}
                  variants={pageTransitionVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "tween", duration: 0.2 }}
                  className="flex justify-center gap-6"
                >
                  {isDoublePage ? (
                    // Double Page layout customized for Hebrew (RTL order: Page N is on right, Page N+1 on left)
                    <div className="flex flex-row-reverse gap-4 max-w-full">
                      {/* Right Page (Primary current page) */}
                      <div className="bg-white rounded shadow-2xl p-1 shrink-0 overflow-hidden select-none border border-zinc-700">
                        <Page 
                          pageNumber={currentPage} 
                          scale={scale} 
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="flex items-center justify-center font-body text-xs text-zinc-500" style={{ width: 400 * scale, height: 560 * scale }}>
                              <Loader2 className="h-6 w-6 animate-spin text-accent" />
                            </div>
                          }
                        />
                        <div className="text-center font-mono text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 bg-zinc-50 py-0.5">
                          {currentPage}
                        </div>
                      </div>

                      {/* Left Page (Next contiguous page, if exists) */}
                      {currentPage + 1 <= (numPages || 0) && (
                        <div className="bg-white rounded shadow-2xl p-1 shrink-0 overflow-hidden select-none border border-zinc-700">
                          <Page 
                            pageNumber={currentPage + 1} 
                            scale={scale} 
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={
                              <div className="flex items-center justify-center font-body text-xs text-zinc-500" style={{ width: 400 * scale, height: 560 * scale }}>
                                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                              </div>
                            }
                          />
                          <div className="text-center font-mono text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 bg-zinc-50 py-0.5">
                            {currentPage + 1}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Single Page elegant mode
                    <div className="bg-white rounded shadow-2xl p-1 shrink-0 overflow-hidden select-none border border-zinc-800">
                      <Page 
                        pageNumber={currentPage} 
                        scale={scale} 
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="flex items-center justify-center font-body text-xs text-zinc-500" style={{ width: 450 * scale, height: 630 * scale }}>
                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                          </div>
                        }
                      />
                      <div className="text-center font-mono text-xs text-zinc-400 pt-1 border-t border-zinc-100 bg-zinc-50 py-1">
                        {currentPage}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
