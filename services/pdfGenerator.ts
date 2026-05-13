import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { ParsedReview } from '../types';

/**
 * Advanced text printing with Justified Alignment logic.
 * jspdf's 'justify' aligns every line to the full width.
 * To make it look correct, we must NOT justify the last line of a paragraph.
 */
const printJustifiedText = (doc: jsPDF, text: string, x: number, startY: number, maxWidth: number, lineHeight: number): number => {
    // 1. Split text into paragraphs (preserving user's paragraph breaks)
    const paragraphs = text.split(/\r?\n/).filter(p => p.trim() !== '');
    
    let currentY = startY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 20;

    paragraphs.forEach(paragraph => {
        // 2. Split paragraph into lines that fit the width
        const lines = doc.splitTextToSize(paragraph, maxWidth);

        lines.forEach((line: string, index: number) => {
            // Check Page Break
            if (currentY > pageHeight - marginBottom) {
                doc.addPage();
                currentY = 20; // Reset to marginTop
            }

            // 3. Logic: If it is the last line of the paragraph, align LEFT. Otherwise JUSTIFY.
            const isLastLine = index === lines.length - 1;
            
            // Note: We use the 'maxWidth' option in text() to enable justification calculations
            doc.text(line, x, currentY, {
                maxWidth: maxWidth,
                align: isLastLine ? 'left' : 'justify'
            });

            currentY += lineHeight;
        });
        
        // Add a little extra space between paragraphs
        currentY += (lineHeight * 0.5); 
    });

    return currentY;
};

// Helper to create the initial JS PDF object
const createPDFDoc = (data: ParsedReview, includeEditorComments: boolean): jsPDF => {
  const doc = new jsPDF();
  
  // -- Constants --
  const marginLeft = 15;
  const marginTop = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxContentWidth = pageWidth - (marginLeft * 2);
  const lineHeight = 5 * 1.15; // Approx 5.75 units per line (11pt is approx 4 units, plus spacing)
  
  // -- Font Setup --
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // -- 1. Header Information (Left Side) --
  let currentY = marginTop;
  
  // ID
  doc.setFont("helvetica", "bold");
  doc.text("Editorial Code:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(data.id, marginLeft + 30, currentY);
  currentY += 6;

  // Title
  const titlePrefix = "Title: ";
  doc.setFont("helvetica", "bold");
  doc.text(titlePrefix, marginLeft, currentY);
  
  doc.setFont("helvetica", "normal");
  // REDUCED WIDTH: Increased subtraction from 70 to 95 to allow more clearance for the table
  const titleWidth = pageWidth - marginLeft - 95; 
  const titleLines = doc.splitTextToSize(data.title.replace(/"/g, ''), titleWidth);
  doc.text(titleLines, marginLeft + 12, currentY);
  currentY += (titleLines.length * 5);

  // Author
  if (data.author) {
    doc.setFont("helvetica", "bold");
    doc.text("Corr. Author:", marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(data.author, marginLeft + 26, currentY);
    currentY += 6;
  }
  
  // -- 2. Ratings Table (Right Side) --
  const tableHeaders = [['Category', '1-10']];
  const tableData = [
    ['Theoretical Contribution', data.ratings.theoretical],
    ['Empirical Contribution', data.ratings.empirical],
    ['Methodological Contribution', data.ratings.methodological],
    ['Breadth', data.ratings.breadth],
    ['Style', data.ratings.style],
    ['Overall Suitability', data.ratings.suitability],
  ];

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: marginTop - 5,
    margin: { left: pageWidth - 65 },
    tableWidth: 50,
    theme: 'plain',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [0, 0, 0]
    },
    headStyles: {
        fontStyle: 'bold',
        fillColor: [206, 215, 231], // Match ced7e7 roughly
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 12, halign: 'center' }
    }
  });

  const tableBottomY = (doc as any).lastAutoTable.finalY + 10;
  currentY = Math.max(currentY + 10, tableBottomY);

  // -- 3. Reviewer Name --
  let reviewerDisplay = data.reviewerName;
  if (data.reviewerNumber) {
     reviewerDisplay = `Reviewer #${data.reviewerNumber}: ${data.reviewerName}`;
  } else if (!reviewerDisplay.toLowerCase().startsWith('reviewer')) {
     reviewerDisplay = `Reviewer: ${reviewerDisplay}`;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(reviewerDisplay, marginLeft, currentY);
  currentY += 10;

  // -- 4. Comments to Editor --
  if (includeEditorComments && data.commentsToEditor) {
    // Label
    doc.setFont("helvetica", "bold");
    doc.text("Comment to Editor:", marginLeft, currentY);
    currentY += 6;
    
    // Content
    doc.setFont("helvetica", "normal");
    // Use helper for justified text
    currentY = printJustifiedText(doc, data.commentsToEditor, marginLeft, currentY, maxContentWidth, lineHeight);
    
    currentY += 5; // Spacer
  }

  // -- 5. Review Body --
  doc.setFont("helvetica", "bold");
  doc.text("Review", marginLeft, currentY);
  currentY += 6;
  
  doc.setFont("helvetica", "normal");
  
  // Use helper for justified text
  currentY = printJustifiedText(doc, data.commentsToAuthor, marginLeft, currentY, maxContentWidth, lineHeight);

  return doc;
}

// Function to handle merging the Generated PDF with an Attachment PDF
export const generateMergedPDFBlob = async (data: ParsedReview, includeEditorComments: boolean): Promise<Blob> => {
    // 1. Generate the base review PDF using jspdf
    const baseDoc = createPDFDoc(data, includeEditorComments);
    const basePdfBytes = baseDoc.output('arraybuffer');

    // 2. If no attachment, return standard blob
    if (!data.attachment) {
        return new Blob([basePdfBytes], { type: 'application/pdf' });
    }

    // 3. Merge using pdf-lib
    try {
        const mergedPdf = await PDFDocument.create();
        
        // Load Base PDF
        const basePdf = await PDFDocument.load(basePdfBytes);
        const copiedBasePages = await mergedPdf.copyPages(basePdf, basePdf.getPageIndices());
        copiedBasePages.forEach((page) => mergedPdf.addPage(page));

        // Load Attachment PDF
        const attachmentBytes = await data.attachment.arrayBuffer();
        const attachmentPdf = await PDFDocument.load(attachmentBytes);
        const copiedAttachmentPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
        copiedAttachmentPages.forEach((page) => mergedPdf.addPage(page));

        const mergedPdfBytes = await mergedPdf.save();
        return new Blob([mergedPdfBytes], { type: 'application/pdf' });
    } catch (e) {
        // Fallback to just the review if merge fails - no console log for privacy
        return new Blob([basePdfBytes], { type: 'application/pdf' });
    }
}

export const generatePDFBlob = (data: ParsedReview, includeEditorComments: boolean): Blob => {
  const doc = createPDFDoc(data, includeEditorComments);
  return doc.output('blob');
}

export const generatePDF = async (data: ParsedReview, includeEditorComments: boolean) => {
  const blob = await generateMergedPDFBlob(data, includeEditorComments);
  
  const prefix = data.reviewerName ? data.reviewerName : 'Unknown Reviewer';
  const suffix = data.reviewerNumber ? `Reviewer ${data.reviewerNumber}` : ``;
  const filename = `${prefix} ${suffix}.pdf`.trim();
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};