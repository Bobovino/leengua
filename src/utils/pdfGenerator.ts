import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export interface TranslationItem {
  original: string;
  translated: string;
}

export function generatePDF(
  translatedContent: TranslationItem[], 
  originalFileName: string, 
  sourceLang: string, 
  targetLang: string
): void {
  const doc = new jsPDF();
  
  // Strip .pdf extension if present
  const baseName = originalFileName.toLowerCase().endsWith('.pdf') 
    ? originalFileName.slice(0, -4) 
    : originalFileName;
    
  // Add title
  const title = `${baseName} (${sourceLang} → ${targetLang})`;
  doc.setFontSize(16);
  doc.text(title, 14, 22);
  
  doc.setFontSize(12);
  doc.text('Translated with Leengua', 14, 30);
  
  // Set up content
  doc.setFontSize(11);
  let yPosition = 45;
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth() - 2 * margin;
  
  translatedContent.forEach((item, index) => {
    // Check if we need a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Add original text with line breaks as needed
    doc.setFont("helvetica", 'normal');
    const originalLines = doc.splitTextToSize(item.original, pageWidth);
    doc.text(originalLines, margin, yPosition);
    yPosition += 4 + (originalLines.length * 5);
    
    // Add translated text with line breaks as needed
    doc.setFont("helvetica", 'italic');
    doc.setTextColor(80, 80, 80);
    const translatedLines = doc.splitTextToSize(item.translated, pageWidth);
    doc.text(translatedLines, margin + 5, yPosition);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", 'normal');
    
    yPosition += (translatedLines.length * 5) + 10;
  });
  
  // Save the PDF
  doc.save(`${baseName}_${sourceLang}_to_${targetLang}.pdf`);
}
