declare module 'pdfjs-dist/legacy/build/pdf' {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }
  
  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }
  
  export interface TextContent {
    items: TextItem[];
  }
  
  export interface TextItem {
    str: string;
    [key: string]: any;
  }
  
  export const getDocument: (params: {
    data: ArrayBuffer | Uint8Array;
    [key: string]: any;
  }) => { promise: Promise<PDFDocumentProxy> };

  export const GlobalWorkerOptions: {
    workerSrc: any;
  };
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.entry' {
  const workerSrc: any;
  export default workerSrc;
}
