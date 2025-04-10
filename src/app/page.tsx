'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { generatePDF } from "../utils/pdfGenerator";

interface Language {
  code: string;
  name: string;
}

interface TranslationItem {
  original: string;
  translated: string;
}

const languages: Language[] = [
  { code: "eng_Latn", name: "English" },
  { code: "spa_Latn", name: "Spanish" },
  { code: "fra_Latn", name: "French" },
  { code: "deu_Latn", name: "German" },
  { code: "ita_Latn", name: "Italian" },
  { code: "por_Latn", name: "Portuguese" },
  { code: "rus_Cyrl", name: "Russian" },
  { code: "zho_Hans", name: "Chinese" },
  { code: "jpn_Jpan", name: "Japanese" }
];

export default function Home() {
  // Model loading
  const [ready, setReady] = useState<boolean | null>(null);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [progressItems, setProgressItems] = useState<Array<{file: string, progress: number}>>([]);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  // PDF processing
  const [file, setFile] = useState<File | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [translatedBook, setTranslatedBook] = useState<TranslationItem[]>([]);
  const [pdfProcessingStatus, setPdfProcessingStatus] = useState<string>("");
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState<number>(0);
  
  // Translation tracking
  const [sourceLanguage, setSourceLanguage] = useState<string>("eng_Latn");
  const [targetLanguage, setTargetLanguage] = useState<string>("spa_Latn");
  const [translatedCount, setTranslatedCount] = useState<number>(0);

  // Create a reference to the worker object.
  const worker = useRef<Worker | null>(null);

  // We use the `useEffect` hook to setup the worker as soon as the component is mounted.
  useEffect(() => {
    if (!worker.current) {
      console.log('Creating worker instance');
      worker.current = new Worker(new URL('../components/worker.ts', import.meta.url), {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e: MessageEvent) => {
      console.log('Received message from worker:', e.data.status, e.data);
      
      switch (e.data.status) {
        case 'initiate':
          // Model file start load: add a new progress item to the list.
          console.log('Model load initiated:', e.data.file);
          setReady(false);
          setProgressItems(prev => [...prev, e.data]);
          break;

        case 'progress':
          // Model file progress: update one of the progress items.
          console.log('Model load progress:', e.data.file, e.data.progress);
          setProgressItems(
            prev => prev.map(item => {
              if (item.file === e.data.file) {
                return { ...item, progress: e.data.progress }
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded: remove the progress item from the list.
          console.log('Model file loaded:', e.data.file);
          setProgressItems(
            prev => prev.filter(item => item.file !== e.data.file)
          );
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          console.log('Translation model ready to use');
          setReady(true);
          break;

        case 'update':
          // Generation update: update the current translation
          console.log('Translation update received');
          break;

        case 'complete':
          // Translation complete: add to translated items
          console.log('Translation complete for a sentence', e.data.output);
          
          if (isTranslating && sentences.length > 0) {
            console.log(`Processing sentence ${translatedCount + 1}/${sentences.length}`);
            const currentSentence = sentences[translatedCount];
            const translatedText = e.data.output[0].translation_text;
            console.log('Original:', currentSentence);
            console.log('Translated:', translatedText);
            
            setTranslatedBook(prev => [
              ...prev, 
              { original: currentSentence, translated: translatedText }
            ]);
            
            const newCount = translatedCount + 1;
            console.log(`Updating translated count to ${newCount}`);
            setTranslatedCount(newCount);
            
            // If there are more sentences to translate, continue
            if (newCount < sentences.length) {
              console.log(`Moving to next sentence (${newCount + 1}/${sentences.length})`);
              translateNextSentence(newCount);
            } else {
              // Translation complete
              console.log('All sentences translated');
              setIsTranslating(false);
              setDisabled(false);
            }
          } else {
            console.error('Received complete message but not in translating state or no sentences');
            console.log('isTranslating:', isTranslating, 'sentences:', sentences.length);
          }
          break;
          
        case 'error':
          console.error('Error from worker:', e.data.message);
          setIsTranslating(false);
          setDisabled(false);
          alert(`Translation error: ${e.data.message}`);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);
    console.log('Message listener attached to worker');

    // Define a cleanup function for when the component is unmounted.
    return () => {
      if (worker.current) {
        worker.current.removeEventListener('message', onMessageReceived);
        console.log('Message listener removed from worker');
      }
    };
  }, [isTranslating, sentences, translatedCount]);

  // Handle file upload via dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      
      try {
        // Reset state
        console.log('File selected:', file.name, 'Size:', file.size);
        setSentences([]);
        setTranslatedBook([]);
        setPdfProcessingStatus("Processing PDF...");
        setPdfProcessingProgress(0);
        
        // Process the PDF content without requiring canvas
        console.log('Starting PDF text extraction...');
        const arrayBuffer = await file.arrayBuffer();
        console.log('PDF loaded into ArrayBuffer, size:', arrayBuffer.byteLength);
        const text = await extractTextFromPdfUsingFetch(arrayBuffer);
        console.log('Text extracted from PDF, length:', text.length);

        // Split into sentences
        setPdfProcessingStatus("Extracting sentences...");
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        const extractedSentences = text.match(sentenceRegex) || [];
        console.log('Sentences extracted:', extractedSentences.length);
        
        if (extractedSentences.length === 0) {
          console.error('No sentences extracted from the text');
          throw new Error("No text could be extracted from the PDF.");
        }
        
        setSentences(extractedSentences);
        console.log('Sentences saved to state:', extractedSentences.length);
        setPdfProcessingStatus("");
        setPdfProcessingProgress(0);
      } catch (error) {
        console.error("Error processing PDF:", error);
        setPdfProcessingStatus("");
        setPdfProcessingProgress(0);
        alert("Failed to process the PDF file. Please try another file.");
      }
    }
  }, []);
  
  // Extract text from PDF using a fetch-based approach to avoid canvas dependency
  const extractTextFromPdfUsingFetch = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      console.log('Starting PDF extraction using CDN approach');
      setPdfProcessingStatus("Converting PDF to text...");

      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('pdf', new Blob([arrayBuffer], { type: 'application/pdf' }));
      console.log('FormData created with PDF blob');
      
      // Use PDF.js library directly from CDN to avoid canvas dependency
      console.log('Loading PDF.js from CDN...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      document.head.appendChild(script);
      
      // Wait for PDF.js to load
      await new Promise<void>((resolve) => {
        script.onload = () => {
          console.log('PDF.js script loaded successfully');
          resolve();
        };
        script.onerror = () => {
          console.error('Failed to load PDF.js script');
          resolve(); // Resolve anyway to continue execution
        };
      });
      
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        console.error('PDF.js library not available in window object');
        throw new Error('PDF.js library failed to load');
      }
      console.log('PDF.js library available:', !!pdfjsLib);
      
      // Configure PDF.js worker
      console.log('Configuring PDF.js worker...');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      
      // Load the PDF document
      console.log('Creating PDF document loading task');
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      console.log('Waiting for PDF document to load...');
      const pdf = await loadingTask.promise;
      console.log('PDF loaded, pages:', pdf.numPages);
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      // Process each page
      for (let i = 1; i <= numPages; i++) {
        console.log(`Processing page ${i} of ${numPages}`);
        setPdfProcessingStatus(`Extracting text from page ${i} of ${numPages}`);
        setPdfProcessingProgress((i / numPages) * 100);
        
        const page = await pdf.getPage(i);
        console.log(`Page ${i} loaded, getting text content`);
        const textContent = await page.getTextContent();
        console.log(`Text content retrieved for page ${i}, items:`, textContent.items.length);
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        console.log(`Text extracted from page ${i}, length:`, pageText.length);
        fullText += pageText + ' ';
      }
      
      // Clean up
      document.head.removeChild(script);
      console.log('PDF extraction complete, total text length:', fullText.length);
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    }
  });

  const translateNextSentence = (index: number) => {
    console.log(`Starting translation of sentence ${index + 1}/${sentences.length}`);
    
    if (!worker.current) {
      console.error('Worker is not initialized');
      return;
    }
    
    if (index >= sentences.length) {
      console.error('Sentence index out of bounds:', index, 'Total sentences:', sentences.length);
      return;
    }
    
    console.log('Sending message to worker:', {
      text: sentences[index],
      src_lang: sourceLanguage,
      tgt_lang: targetLanguage,
    });
    
    worker.current.postMessage({
      text: sentences[index],
      src_lang: sourceLanguage,
      tgt_lang: targetLanguage,
    });
  };
  
  // Add a function to check if the worker is initialized
  const ensureWorkerReady = () => {
    console.log('Ensuring worker is ready, current state:', { ready, worker: !!worker.current });
    
    if (ready === true) {
      console.log('Worker is already ready');
      return Promise.resolve(true);
    }
    
    if (!worker.current) {
      console.log('Creating worker as it does not exist yet');
      worker.current = new Worker(new URL('../components/worker.ts', import.meta.url), {
        type: 'module'
      });
      
      // Set up message handler if not already done in useEffect
      worker.current.addEventListener('message', (e: MessageEvent) => {
        console.log('Direct message from worker:', e.data);
        if (e.data.status === 'ready') {
          console.log('Worker reported ready status directly');
          setReady(true);
        }
      });
    }
    
    // Send a ping message to check if worker is ready
    return new Promise<boolean>((resolve) => {
      if (!worker.current) {
        console.error('Worker could not be created');
        resolve(false);
        return;
      }
      
      console.log('Sending ping to worker to initialize if needed');
      
      // Set a timeout to resolve with false if we don't get a response
      const timeout = setTimeout(() => {
        console.log('Worker did not respond within timeout');
        resolve(false);
      }, 2000);
      
      // One-time message handler for the ping response
      const pingHandler = (e: MessageEvent) => {
        if (e.data.status === 'ready' || e.data.task_status === 'complete') {
          console.log('Worker responded to ping, ready for translation');
          clearTimeout(timeout);
          worker.current?.removeEventListener('message', pingHandler);
          setReady(true);
          resolve(true);
        }
      };
      
      worker.current.addEventListener('message', pingHandler);
      
      // Send a ping message to the worker
      worker.current.postMessage({ type: 'ping' });
    });
  };
  
  const handleTranslate = async () => {
    console.log('Translate button clicked');
    console.log('State:', { ready, sentences: sentences.length, isTranslating });
    
    if (isTranslating) {
      console.log('Already translating, ignoring click');
      return;
    }
    
    if (sentences.length === 0) {
      console.error('No sentences to translate');
      return;
    }
    
    // Check if worker is ready or try to initialize it
    if (ready !== true) {
      console.log('Worker not ready, attempting to initialize');
      setDisabled(true);
      const isReady = await ensureWorkerReady();
      if (!isReady) {
        console.error('Failed to initialize translation model');
        alert('Could not initialize translation model. Please reload the page and try again.');
        setDisabled(false);
        return;
      }
      console.log('Worker is now ready');
    }
    
    // Reset translation state
    console.log('Starting translation process');
    setTranslatedBook([]);
    setTranslatedCount(0);
    setIsTranslating(true);
    setDisabled(true);
    
    // Start translating the first sentence
    translateNextSentence(0);
  };
  
  const handleDownloadPDF = () => {
    if (translatedBook.length > 0 && file) {
      generatePDF(translatedBook, file.name, 
        languages.find(l => l.code === sourceLanguage)?.name || sourceLanguage, 
        languages.find(l => l.code === targetLanguage)?.name || targetLanguage
      );
    }
  };

  // Calculate translation progress
  const translationProgress = sentences.length > 0 
    ? Math.round((translatedCount / sentences.length) * 100)
    : 0;

  return (
    <div className="min-h-screen p-8 pb-20 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Leengua</h1>
        <p className="text-gray-600 dark:text-gray-300">Learn languages by reading books with side-by-side translation</p>
      </header>

      <main className="w-full max-w-4xl flex flex-col gap-8">
        {/* File Upload Section */}
        <section className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
          <div 
            {...getRootProps()} 
            className={`flex flex-col items-center justify-center cursor-pointer h-32 ${
              isDragActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <input {...getInputProps()} />
            <Image
              src="/file.svg"
              alt="Upload icon"
              width={32}
              height={32}
              className="mb-2 dark:invert"
            />
            {file ? (
              <p>Selected file: {file.name}</p>
            ) : (
              <div className="text-center">
                <p className="mb-1">Drag and drop a PDF file here, or click to select</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Only PDF files are supported</p>
              </div>
            )}
          </div>
        </section>

        {/* PDF Processing Status */}
        {pdfProcessingStatus && (
          <div className="mt-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{pdfProcessingStatus}</span>
                {pdfProcessingProgress > 0 && (
                  <span className="text-sm">{Math.round(pdfProcessingProgress)}%</span>
                )}
              </div>
              {pdfProcessingProgress > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${pdfProcessingProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model Loading Progress */}
        {ready === false && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Loading translation model...</h3>
            {progressItems.map(data => (
              <div key={data.file} className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{data.file}</span>
                  <span className="text-sm">{Math.round(data.progress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${data.progress * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Language Selection */}
        {file && sentences.length > 0 && (
          <section className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block mb-2 text-sm font-medium">Source Language</label>
              <select 
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                disabled={isTranslating}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block mb-2 text-sm font-medium">Target Language</label>
              <select 
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                disabled={isTranslating}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Translation Button & Progress */}
        {sentences.length > 0 && (
          <section className="flex flex-col gap-4">
            <button 
              onClick={handleTranslate} 
              disabled={isTranslating || ready === false || disabled}
              className={`py-2 px-4 rounded-md ${
                isTranslating || ready === false || disabled 
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {ready === false 
                ? "Loading translation model..." 
                : isTranslating 
                  ? "Translating..." 
                  : "Translate Book"}
            </button>
            
            {isTranslating && (
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span>Translation progress:</span>
                  <span>{translatedCount} of {sentences.length} sentences ({translationProgress}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${translationProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Translated Content */}
        {translatedBook.length > 0 && (
          <section className="mt-8">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Translated Book</h2>
              <button 
                onClick={handleDownloadPDF}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md"
              >
                Download PDF
              </button>
            </div>
            
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto">
              {translatedBook.map((item, index) => (
                <div key={index} className="mb-4">
                  <p className="mb-1 font-medium">{item.original}</p>
                  <p className="pl-4 text-gray-600 dark:text-gray-400">{item.translated}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}