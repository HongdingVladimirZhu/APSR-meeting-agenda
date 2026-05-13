import { ParsedReview, Ratings } from '../types';

export const parseReviewText = (text: string): ParsedReview => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Extract ID
  const idLine = lines.find(l => l.startsWith('APSR-'));
  const id = idLine || 'Unknown ID';

  // 2. Extract Title
  const titleMatch = text.match(/"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : (lines.find(l => !l.startsWith('APSR-') && !l.startsWith('Corr. Author') && l.length > 20) || 'Unknown Title');

  // 3. Extract Author (From text if present, though app now prefers manual input)
  let author = '';
  const authorLine = lines.find(l => l.includes('Corr. Author:') || l.includes('Author:'));
  if (authorLine) {
    author = authorLine.replace(/Corr\.?\s*Author:/i, '').replace(/Author:/i, '').trim();
  }

  // 4. Extract Reviewer Name & Number
  // Format: "Joseph Wright, PHD (Reviewer 1)"
  const reviewerLine = lines.find(l => /\(Reviewer\s+\d+\)/i.test(l));
  let reviewerName = 'Unknown Reviewer';
  let reviewerNumber = '';

  if (reviewerLine) {
    const match = reviewerLine.match(/^(.*?)\s+\(Reviewer\s+(\d+)\)/i);
    if (match) {
        reviewerName = match[1].trim(); 
        reviewerNumber = match[2].trim(); 
    } else {
        reviewerName = reviewerLine;
    }
  }

  // Clean Reviewer Name (Remove PHD, Ph.D, etc.)
  reviewerName = reviewerName.replace(/,\s*Ph\.?D\.?/gi, '').replace(/,\s*M\.?A\.?/gi, '').trim();

  // 5. Extract Ratings
  const ratings: Ratings = {
    theoretical: extractScore(text, 'Theoretical contribution'),
    empirical: extractScore(text, 'Empirical contribution'),
    methodological: extractScore(text, 'Methodological contribution'),
    breadth: extractScore(text, 'Breadth'),
    style: extractScore(text, 'style?'), 
    suitability: extractScore(text, 'suitability for publication?'),
  };

  // 6. Extract Comments
  // Added "More Reviewer Details" to stop markers
  const stopMarkers = [
      'Manuscript Rating Question(s):', 
      'Custom Review Question(s):', 
      'attachment:', 
      'Attachment:', 
      'Attachments:', // Added to catch plural form
      'More Reviewer Details'
  ];
  
  // Comments to Editor
  const commentsToEditor = extractSection(text, 'Comments to Editor:', 'Comments to Author:', undefined);
  
  // Comments to Author
  let commentsToAuthor = extractSection(text, 'Comments to Author:', stopMarkers, 'Review');
  
  // Fallback: sometimes "Review" is the header
  if (!commentsToAuthor && text.includes('\nReview\n')) {
     commentsToAuthor = extractSection(text, 'Review', stopMarkers);
  }

  return {
    id,
    title,
    author,
    reviewerName,
    reviewerNumber,
    ratings,
    commentsToEditor,
    commentsToAuthor,
    attachment: null,
  };
};

const extractScore = (fullText: string, keyword: string): string => {
  const lines = fullText.split('\n');
  const targetLine = lines.find(l => l.toLowerCase().includes(keyword.toLowerCase()));
  if (!targetLine) return '';
  
  const matches = targetLine.match(/(\d{1,2})\s*$/);
  if (matches) return matches[1];
  
  return '';
};

const extractSection = (fullText: string, startPhrase: string, endPhrase: string | string[], alternativeStart?: string): string => {
  let startIndex = fullText.indexOf(startPhrase);
  let actualStart = 0;

  if (startIndex !== -1) {
    actualStart = startIndex + startPhrase.length;
  } else if (alternativeStart) {
    startIndex = fullText.indexOf(alternativeStart);
    if (startIndex !== -1) {
       actualStart = startIndex + alternativeStart.length;
    } else {
        return '';
    }
  } else {
      return '';
  }
  
  const stopMarkers = Array.isArray(endPhrase) ? endPhrase : [endPhrase];
  const contentSubstr = fullText.substring(actualStart);
  
  let relativeEndIndex = Number.MAX_SAFE_INTEGER;
  let found = false;

  for (const marker of stopMarkers) {
      const lowerSub = contentSubstr.toLowerCase();
      const lowerMarker = marker.toLowerCase();
      const idx = lowerSub.indexOf(lowerMarker);

      if (idx !== -1 && idx < relativeEndIndex) {
          relativeEndIndex = idx;
          found = true;
      }
  }

  let content = '';
  if (found) {
    content = contentSubstr.substring(0, relativeEndIndex);
  } else {
    content = contentSubstr;
  }

  return content.trim();
};