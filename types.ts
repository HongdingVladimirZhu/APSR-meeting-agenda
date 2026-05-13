export interface Ratings {
  theoretical: string;
  empirical: string;
  methodological: string;
  breadth: string;
  style: string;
  suitability: string;
}

export interface ParsedReview {
  id: string;
  title: string;
  author: string; 
  reviewerName: string;
  reviewerNumber: string; // "1", "2", "3" etc.
  ratings: Ratings;
  commentsToEditor: string;
  commentsToAuthor: string;
  attachment: File | null;
}

export interface ParseError {
  message: string;
}