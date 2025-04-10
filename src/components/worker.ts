import { pipeline, Pipeline, env } from '@xenova/transformers';

// Enable debug logs for the worker
env.debug = true;

// Define types for our translation pipeline
type TranslationPipeline = Pipeline & {
  tokenizer: {
    decode: (tokens: Array<number>, options?: { skip_special_tokens?: boolean }) => string
  }
};

type ProgressCallbackData = {
  status: string;
  file?: string;
  progress?: number;
  task_status?: string;
};

type TranslationOptions = {
  src_lang: string;
  tgt_lang: string;
  callback_function?: (x: any) => void;
};

/**
 * This class uses the Singleton pattern to ensure that only one instance of the
 * pipeline is loaded. This is because loading the pipeline is an expensive
 * operation and we don't want to do it every time we want to translate a sentence.
 */
class MyTranslationPipeline {
    static task = 'translation' as const;
    static model = 'Xenova/nllb-200-distilled-600M';
    static instance: TranslationPipeline | null = null;

    static async getInstance(progress_callback: ((data: ProgressCallbackData) => void) | null = null): Promise<TranslationPipeline> {
        console.log('Getting translation pipeline instance');
        
        if (this.instance === null) {
            console.log('Creating new pipeline instance');
            try {
                this.instance = await pipeline(this.task, this.model, { progress_callback }) as TranslationPipeline;
                console.log('Pipeline created successfully');
            } catch (error) {
                console.error('Error creating pipeline:', error);
                throw error;
            }
        } else {
            console.log('Returning existing pipeline instance');
        }

        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent) => {
    console.log('Worker received message:', event.data);
    
    // Handle ping message to check readiness
    if (event.data.type === 'ping') {
        try {
            // Try to initialize the pipeline if needed
            console.log('Received ping, initializing pipeline if needed');
            await MyTranslationPipeline.getInstance();
            
            // Send ready status back
            self.postMessage({
                status: 'ready',
                message: 'Worker is ready for translation'
            });
            return;
        } catch (error) {
            console.error('Error initializing pipeline during ping:', error);
            self.postMessage({
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to initialize translation model'
            });
            return;
        }
    }
    
    try {
        // Retrieve the translation pipeline. When called for the first time,
        // this will load the pipeline and save it for future use.
        console.log('Getting translation pipeline...');
        let translator = await MyTranslationPipeline.getInstance((x: ProgressCallbackData) => {
            // We also add a progress callback to the pipeline so that we can
            // track model loading.
            console.log('Pipeline progress update:', x);
            self.postMessage(x);
        });
        console.log('Translation pipeline ready');

        // Actually perform the translation
        console.log('Starting translation...');
        console.log('Input:', event.data.text);
        console.log('Source language:', event.data.src_lang);
        console.log('Target language:', event.data.tgt_lang);
        
        const options: TranslationOptions = {
            tgt_lang: event.data.tgt_lang,
            src_lang: event.data.src_lang,
            // Allows for partial output
            callback_function: (x: any) => {
                console.log('Partial translation update:', x);
                if (translator && x[0]?.output_token_ids) {
                    self.postMessage({
                        status: 'update',
                        output: translator.tokenizer.decode(x[0].output_token_ids, { skip_special_tokens: true })
                    });
                }
            }
        };
        
        let output = await translator(event.data.text, options);
        
        console.log('Translation complete:', output);

        // Send the output back to the main thread
        self.postMessage({
            status: 'complete',
            output: output,
        });
    } catch (error: unknown) {
        console.error('Translation error in worker:', error);
        // Send any errors back to the main thread
        self.postMessage({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred during translation'
        });
    }
});

// Log when the worker is initialized
console.log('Translation worker initialized');