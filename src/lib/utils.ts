import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export const parseRawTranscript = (rawDbTranscript: any): TranscriptSegment[] => {
  let loadedSegments: TranscriptSegment[] = [];
  if (Array.isArray(rawDbTranscript)) {
    loadedSegments = rawDbTranscript;
  } else if (typeof rawDbTranscript === 'string') {
    try {
      loadedSegments = JSON.parse(rawDbTranscript);
    } catch (e) {
      console.log("JSON parse failed, trying plain text fallback...");
      const regex = /\[(?:(\d+):)?(\d+):(\d+)\]\s*([^[]+)/g;
      let match;
      const parsedSegments = [];
      while ((match = regex.exec(rawDbTranscript)) !== null) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const mins = parseInt(match[2]);
        const secs = parseInt(match[3]);
        let content = match[4].trim();
        
        if (content.includes("---")) {
           content = content.split("---")[0].trim();
        }
        
        if (content) {
          parsedSegments.push({
            start: hours * 3600 + mins * 60 + secs,
            duration: 15,
            text: content
          });
        }
      }
      
      if (parsedSegments.length === 0) {
        // Fallback for [MM:SS] format
        const regex2 = /\[(\d+):(\d+)\]\s*([^[]+)/g;
        while ((match = regex2.exec(rawDbTranscript)) !== null) {
          const mins = parseInt(match[1]);
          const secs = parseInt(match[2]);
          let content = match[3].trim();
          
          if (content.includes("---")) {
             content = content.split("---")[0].trim();
          }
          
          if (content) {
            parsedSegments.push({
              start: mins * 60 + secs,
              duration: 15,
              text: content
            });
          }
        }
      }
      
      if (parsedSegments.length > 0) {
         loadedSegments = parsedSegments;
      }
    }
  }

  // Deduplicate overlapping segments (sliding window ASR)
  const wordItems: {word: string, seg: TranscriptSegment}[] = [];
  for (const seg of loadedSegments) {
     const words = seg.text ? seg.text.split(/\s+/).filter(Boolean) : [];
     for (const w of words) {
        wordItems.push({ word: w, seg });
     }
  }

  const resultItems: {word: string, seg: TranscriptSegment}[] = [];
  
  function cleanWord(w: string) { return w.replace(/[.,!?]/g, ''); }

  for (let i = 0; i < wordItems.length; i++) {
    let bestOverlapLen = 0;
    const lookback = Math.min(resultItems.length, 30);
    const resultSearchSpace = resultItems.slice(resultItems.length - lookback);
    
    for (let j = 0; j < resultSearchSpace.length; j++) {
       let matchLen = 0;
       while (
         j + matchLen < resultSearchSpace.length && 
         i + matchLen < wordItems.length &&
         cleanWord(resultSearchSpace[j + matchLen].word) === cleanWord(wordItems[i + matchLen].word)
       ) {
         matchLen++;
       }
       if (matchLen >= 3 && (j + matchLen >= resultSearchSpace.length - 2)) {
         if (matchLen > bestOverlapLen) {
           bestOverlapLen = matchLen;
         }
       }
    }
    
    if (bestOverlapLen >= 3) {
      i += bestOverlapLen - 1; 
    } else {
      let directRepeat = 0;
      for (let len = 2; len >= 1; len--) {
        if (resultItems.length >= len && i + len <= wordItems.length) {
          let match = true;
          for (let k = 0; k < len; k++) {
            if (cleanWord(resultItems[resultItems.length - len + k].word) !== cleanWord(wordItems[i + k].word)) {
              match = false; break;
            }
          }
          if (match) {
            directRepeat = len;
            break;
          }
        }
      }
      
      if (directRepeat > 0) {
        i += directRepeat - 1;
      } else {
        resultItems.push(wordItems[i]);
      }
    }
  }

  const cleaned: TranscriptSegment[] = [];
  let currentSeg: TranscriptSegment | null = null;
  let currentWords: string[] = [];
  
  for (const item of resultItems) {
     if (!currentSeg) {
        currentSeg = { ...item.seg };
        currentWords = [item.word];
     } else if (currentSeg.start === item.seg.start) {
        currentWords.push(item.word);
     } else {
        currentSeg.text = currentWords.join(" ");
        cleaned.push(currentSeg);
        currentSeg = { ...item.seg };
        currentWords = [item.word];
     }
  }
  
  if (currentSeg) {
     currentSeg.text = currentWords.join(" ");
     cleaned.push(currentSeg);
  }

  return cleaned;
};
