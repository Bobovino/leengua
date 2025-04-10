import { useState, useEffect, useRef } from 'react';

interface UseTranslationWorkerProps {
  onComplete: (result: any[]) => void;
  onProgress?: (progress: number) => void;
  onUpdate?: (partialResult: string) => void;
}

interface TranslationItem {
  original: string;
  translated: string;
}

export function useTranslationWorker({
  onComplete,
  onProgress,
  onUpdate
}: UseTranslationWorkerProps) {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [initializationStatus, setInitializationStatus] = useState<string>("Loading translation model...");
  const [translatedSentences, setTranslatedSentences] = useState<number>(0);
  const [totalSentences, setTotalSentences] = useState<number>(0);
  
  const workerRef = useRef<Worker | null>(null);
  
  useEffect(() => {
    // Initialize worker
    const initWorker = async () => {
      // Create worker only on client side
      if (typeof window !== 'undefined') {
        try {
          // Dynamic import for the worker
          const worker = new Worker(new URL('../components/worker.ts', import.meta.url));
          
          workerRef.current = worker;
          
          // Setup message handling
          worker.onmessage = (event) => {
            const data = event.data;
            
            if (data.status === 'update') {
              // Handle partial translation update
              if (onUpdate) onUpdate(data.output);
            } else if (data.status === 'complete') {
              // Handle complete translation
              onComplete(data.output);
            } else if (data.task_status === 'progress') {
              // Handle progress update during model loading
              const percent = Math.round(data.progress * 100);
              setProgress(percent);
              if (onProgress) onProgress(percent);
              setInitializationStatus(`Loading model: ${percent}%`);
            } else if (data.task_status === 'complete') {
              // Model is loaded and ready
              setIsInitialized(true);
              setInitializationStatus("Ready to translate");
            }
          };
        } catch (error) {
          console.error('Error initializing translation worker:', error);
          setInitializationStatus("Failed to load translation model");
        }
      }
    };
    
    initWorker();
    
    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [onComplete, onProgress, onUpdate]);
  
  const startTranslation = (sentences: string[], sourceLang: string, targetLang: string) => {
    if (!workerRef.current || !isInitialized) {
      return;
    }
    
    setTotalSentences(sentences.length);
    setTranslatedSentences(0);
    setProgress(0);
    
    const results: TranslationItem[] = [];
    
    // Process sentences one by one
    const processSentence = (index: number) => {
      if (index >= sentences.length) {
        // All sentences processed
        onComplete(results);
        return;
      }
      
      const sentence = sentences[index];
      
      // Map language codes to NLLB language codes
      const languageMap: Record<string, string> = {
        'en': 'eng_Latn',
        'es': 'spa_Latn',
        'fr': 'fra_Latn',
        'de': 'deu_Latn',
        'it': 'ita_Latn',
        'pt': 'por_Latn',
        'ru': 'rus_Cyrl',
        'zh': 'zho_Hans',
        'ja': 'jpn_Jpan'
      };
      
      // Use mapped language codes or defaults
      const mappedSourceLang = languageMap[sourceLang] || 'eng_Latn';
      const mappedTargetLang = languageMap[targetLang] || 'spa_Latn';
      
      // Setup one-time message handler for this sentence
      const messageHandler = (event: MessageEvent) => {
        const data = event.data;
        
        if (data.status === 'complete') {
          // Add result to list
          results.push({
            original: sentence,
            translated: data.output[0].translation_text
          });
          
          // Update progress
          setTranslatedSentences(index + 1);
          setProgress(((index + 1) / sentences.length) * 100);
          
          // Remove this handler as we're done with this sentence
          if (workerRef.current) {
            workerRef.current.removeEventListener('message', messageHandler);
          }
          
          // Process next sentence
          processSentence(index + 1);
        }
      };
      
      // Add temporary message handler for this sentence
      if (workerRef.current) {
        workerRef.current.addEventListener('message', messageHandler);
        
        // Send translation request
        workerRef.current.postMessage({
          text: sentence,
          src_lang: mappedSourceLang,
          tgt_lang: mappedTargetLang
        });
      }
    };
    
    // Start processing with the first sentence
    processSentence(0);
  };
  
  return {
    startTranslation,
    progress,
    totalSentences,
    translatedSentences,
    isInitialized,
    initializationStatus
  };
}
