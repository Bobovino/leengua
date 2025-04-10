import { pipeline } from '@xenova/transformers';

/**
 * This class uses the Singleton pattern to ensure that only one instance of the
 * pipeline is loaded. This is because loading the pipeline is an expensive
 * operation and we don't want to do it every time we want to translate a sentence.
 */
class MyTranslationPipeline {
    static task = 'translation';
    static model = 'Xenova/nllb-200-distilled-600M';
    static instance: any = null;

    static async getInstance(progress_callback: ((progress: any) => void) | null = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }

        return this.instance;
    }
}

// Type definitions for worker messages
interface TranslationRequest {
    text: string;
    src_lang: string;
    tgt_lang: string;
}

interface ProgressUpdate {
    status: 'update';
    output: string;
}

interface CompletionMessage {
    status: 'complete';
    output: any;
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent<TranslationRequest>) => {
    // Retrieve the translation pipeline. When called for the first time,
    // this will load the pipeline and save it for future use.
    let translator = await MyTranslationPipeline.getInstance(x => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage(x);
    });

    // Actually perform the translation
    let output = await translator(event.data.text, {
        tgt_lang: event.data.tgt_lang,
        src_lang: event.data.src_lang,

        // Allows for partial output
        callback_function: (x: any) => {
            self.postMessage({
                status: 'update',
                output: translator.tokenizer.decode(x[0].output_token_ids, { skip_special_tokens: true })
            } as ProgressUpdate);
        }
    });

    // Send the output back to the main thread
    self.postMessage({
        status: 'complete',
        output: output,
    } as CompletionMessage);
});

// Need to export empty object to make TypeScript treat this as a module
export {};