import React, { useState, useRef } from 'react';
import { FileText, Download, AlertCircle, PenTool, Trash2, Plus, Paperclip, Folder, Home } from 'lucide-react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { parseReviewText } from './services/parser';
import { generatePDF, generateMergedPDFBlob } from './services/pdfGenerator';
import { ParsedReview } from './types';

function App() {
  // Global Article State
  const [globalAuthor, setGlobalAuthor] = useState('');
  const [globalId, setGlobalId] = useState('');
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  
  // Review Processing State
  const [inputText, setInputText] = useState('');
  const [includeEditorComments, setIncludeEditorComments] = useState(true);
  const [reviewAttachment, setReviewAttachment] = useState<File | null>(null);
  const [reviews, setReviews] = useState<ParsedReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const manuscriptInputRef = useRef<HTMLInputElement>(null);
  const reviewAttachmentInputRef = useRef<HTMLInputElement>(null);

  const handleManuscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setManuscriptFile(e.target.files[0]);
      setReviews([]);
      setInputText('');
      setReviewAttachment(null);
      setError(null);
      if (reviewAttachmentInputRef.current) {
        reviewAttachmentInputRef.current.value = '';
      }
    }
  };

  const handleReviewAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
          setError('Review attachments must be PDF files.');
          return;
      }
      setReviewAttachment(file);
      setError(null);
    }
  }

  const handleAddReview = () => {
    try {
      if (!inputText.trim()) {
        setError('Please paste the reviewer text first.');
        return;
      }
      
      const result = parseReviewText(inputText);
      
      // Override parsed fields with global manual inputs if set
      if (globalAuthor.trim()) {
        result.author = globalAuthor.trim();
      }
      
      if (globalId.trim()) {
        result.id = globalId.trim();
      } else if (result.id && result.id !== 'Unknown ID') {
        setGlobalId(result.id);
      }

      // Basic validation
      if (result.reviewerName === 'Unknown Reviewer' && !result.reviewerNumber) {
        setError("Could not detect a valid Reviewer Name or Number. Please check the text format.");
        return;
      }

      // Add attachment if exists
      if (reviewAttachment) {
          result.attachment = reviewAttachment;
      }

      // Add to list
      setReviews(prev => [...prev, result]);
      
      // Reset input for next review
      setInputText('');
      setReviewAttachment(null);
      if (reviewAttachmentInputRef.current) {
          reviewAttachmentInputRef.current.value = '';
      }
      setError(null);
    } catch (err) {
      setError('An error occurred while parsing the text.');
    }
  };

  const removeReview = (index: number) => {
    setReviews(prev => prev.filter((_, i) => i !== index));
  };

  // Generate a composite name for the folder
  const getCompositeName = () => {
    const idPart = globalId || 'APSR-Unknown';
    const authorPart = globalAuthor || 'Unknown-Author';
    return `${idPart} ${authorPart}`.trim();
  }

  // Download logic: ZIP Folder containing Manuscript + PDFs
  const downloadAsZip = async () => {
    const zip = new JSZip();
    const folderName = getCompositeName();
    const folder = zip.folder(folderName);
    
    if (!folder) return;

    // 1. Add Manuscript
    if (manuscriptFile) {
        const ext = manuscriptFile.name.split('.').pop();
        // Rename manuscript to ID if available
        const filename = globalId ? `${globalId}.${ext}` : manuscriptFile.name;
        folder.file(filename, manuscriptFile);
    }

    // 2. Add Reviews
    for (const review of reviews) {
      const blob = await generateMergedPDFBlob(review, includeEditorComments);
      const prefix = review.reviewerName ? review.reviewerName : 'Unknown Reviewer';
      const suffix = review.reviewerNumber ? `Reviewer ${review.reviewerNumber}` : ``;
      const filename = `${prefix} ${suffix}.pdf`.trim();
      folder.file(filename, blob);
    }

    // 3. Generate and Save
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${folderName}.zip`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-serif pb-24">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <a
              href="/"
              className="inline-flex items-center rounded border border-gray-400 bg-[#fcfbf9] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Agenda
            </a>
          </div>
          <div className="flex justify-center">
             <div className="h-16 w-16 bg-gray-800 rounded-full flex items-center justify-center text-white border-4 border-gray-600 shadow-xl">
               <FileText className="h-8 w-8" />
             </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 typewriter tracking-wider">
            APSR REVIEW MANAGER
          </h1>
          <p className="text-gray-600 italic">
            "Automated clerical services for the modern scholar"
          </p>
        </div>

        {/* Instructions Card */}
        <div className="bg-[#fcfbf9] border border-gray-300 p-6 shadow-md paper-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-800 opacity-20"></div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 typewriter uppercase border-b border-gray-300 pb-1 w-max">Instructions</h3>
            <div className="space-y-3 text-sm text-gray-700 font-sans">
                <div className="flex items-start">
                    <span className="step-number">1</span>
                    <p>Copy all text from the Editorial Manager Reviewer page (Ctrl+A / Cmd+A).</p>
                </div>
                <div className="flex items-start">
                    <span className="step-number">2</span>
                    <p>Paste it into the text box below.</p>
                </div>
                <div className="flex items-start">
                    <span className="step-number">3</span>
                    <p>Enter <strong>both</strong> the <strong>APSR ID</strong> and the <strong>Corresponding Author's name</strong> in the fields provided.</p>
                </div>
                <div className="flex items-start">
                    <span className="step-number">4</span>
                    <p>Upload the <strong>original manuscript</strong> file.</p>
                </div>
                <div className="flex items-start">
                    <span className="step-number">5</span>
                    <p>Decide whether to include "Comments to Editor" using the checkbox.</p>
                </div>
                <div className="flex items-start">
                    <span className="step-number">6</span>
                    <p>Upload a PDF attachment if the reviewer provided a separate file.</p>
                </div>
                <p className="mt-4 pt-2 border-t border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-widest italic">
                   Note: Repeat the parsing steps for each reviewer to compile your list.
                </p>
            </div>
        </div>

        {/* SECTION 1: ARTICLE DETAILS */}
        <div className="bg-[#fcfbf9] border-2 border-gray-300 p-6 shadow-md paper-shadow relative">
           <div className="absolute top-0 left-0 w-full h-1 bg-gray-800 opacity-20"></div>
           <h3 className="text-lg font-bold text-gray-800 mb-4 typewriter uppercase border-b border-gray-300 pb-1 w-full flex items-center">
             <PenTool className="w-5 h-5 mr-2"/> Article Details & Files
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* ID Input */}
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">APSR ID</label>
                 <input 
                   type="text" 
                   className="block w-full border-b-2 border-gray-300 bg-transparent py-2 px-1 font-mono text-gray-900 focus:border-gray-800 focus:outline-none placeholder-gray-400"
                   placeholder="APSR-D-25-XXXXX"
                   value={globalId}
                   onChange={(e) => setGlobalId(e.target.value)}
                 />
              </div>

              {/* Author Input */}
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Corresponding Author</label>
                 <input 
                   type="text" 
                   className="block w-full border-b-2 border-gray-300 bg-transparent py-2 px-1 font-serif text-lg font-bold text-gray-900 focus:border-gray-800 focus:outline-none placeholder-gray-400"
                   placeholder="e.g. Hongding Zhu"
                   value={globalAuthor}
                   onChange={(e) => setGlobalAuthor(e.target.value)}
                 />
              </div>
           </div>

           {/* Manuscript Upload - Dashed Border Style */}
           <div className="border-2 border-dashed border-gray-400 rounded-lg p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors flex items-center justify-between group">
              <div className="flex items-center">
                  <div className="p-2 bg-white border border-gray-300 rounded mr-3 shadow-sm text-gray-600">
                     <FileText className="w-5 h-5" />
                  </div>
                  <div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Original Manuscript</h4>
                      <p className="text-xs text-gray-500 italic">
                          {manuscriptFile ? manuscriptFile.name : "No file selected"}
                      </p>
                  </div>
              </div>
              
              <div>
                 <input 
                    type="file" 
                    ref={manuscriptInputRef}
                    className="hidden"
                    onChange={handleManuscriptUpload}
                 />
                 <button 
                    onClick={() => manuscriptInputRef.current?.click()}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition-all shadow-sm rounded"
                 >
                    {manuscriptFile ? 'Replace File' : 'Upload File'}
                 </button>
              </div>
           </div>
        </div>

        {/* SECTION 2: ADD REVIEW INPUT */}
        <div className="bg-white border-2 border-gray-300 shadow-lg p-6 space-y-4 paper-shadow">
          <div className="flex justify-between items-center mb-2">
             <h3 className="text-lg font-bold text-gray-800 typewriter uppercase">Add New Review</h3>
          </div>
          
          <div className="relative">
             <textarea
               rows={8}
               className="block w-full sm:text-sm border-2 border-gray-200 rounded p-4 bg-gray-50 text-gray-900 font-mono text-xs focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none transition-all"
               placeholder="Paste raw reviewer text here..."
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
             />
          </div>
          
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-100">
            
            <div className="flex items-center space-x-6 w-full md:w-auto">
                 {/* Checkbox: Left Side */}
                <div className="flex items-center">
                    <input
                        id="comments-editor"
                        type="checkbox"
                        className="h-4 w-4 text-gray-800 border-gray-300 rounded focus:ring-gray-500"
                        checked={includeEditorComments}
                        onChange={(e) => setIncludeEditorComments(e.target.checked)}
                    />
                    <label htmlFor="comments-editor" className="ml-2 block text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer">
                        Include Comments to Editor
                    </label>
                </div>

                 {/* Attachment Upload: Next to checkbox */}
                <div className="flex items-center">
                     <input
                        type="file"
                        ref={reviewAttachmentInputRef}
                        className="hidden"
                        accept="application/pdf"
                        onChange={handleReviewAttachmentUpload}
                     />
                     <button
                        onClick={() => reviewAttachmentInputRef.current?.click()}
                        className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-wide hover:text-blue-800 transition-colors"
                     >
                        <Paperclip className="w-4 h-4 mr-1"/>
                        {reviewAttachment ? "Attachment Added (PDF)" : "Upload PDF Attachment"}
                     </button>
                </div>
            </div>

             {/* Add Button: Right Side */}
            <button
               onClick={handleAddReview}
               className="inline-flex items-center px-6 py-2 border-2 border-gray-800 text-sm font-bold uppercase tracking-widest text-white bg-gray-800 hover:bg-white hover:text-gray-800 transition-colors duration-300 shadow-lg whitespace-nowrap"
             >
               <Plus className="w-4 h-4 mr-2"/> Parse & Add
             </button>
          </div>

           {/* Error Message */}
            {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-4">
                <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700 font-bold">{error}</p>
                </div>
            </div>
            )}
        </div>

        {/* SECTION 3: REVIEWS LIST */}
        {reviews.length > 0 && (
            <div className="space-y-4 animate-fade-in-up">
                <div className="flex items-center justify-between border-b-2 border-gray-300 pb-2">
                     <h3 className="text-xl font-bold text-gray-800 typewriter">Processed Reviews ({reviews.length})</h3>
                     <button
                        onClick={downloadAsZip}
                        className="text-xs font-bold uppercase tracking-widest text-gray-600 border border-gray-400 px-3 py-1 hover:bg-gray-100 transition-colors flex items-center"
                     >
                         <Folder className="w-3 h-3 mr-2"/> Download As ZIP Folder
                     </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {reviews.map((review, idx) => (
                        <div key={idx} className="bg-[#fffdf5] border border-gray-300 p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                                <button 
                                    onClick={() => generatePDF(review, includeEditorComments)}
                                    title="Download Single PDF"
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => removeReview(idx)}
                                    title="Remove"
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-gray-200 text-gray-600 font-mono font-bold w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full mr-4 text-base border border-gray-400">
                                    {review.reviewerNumber || '?'}
                                </div>
                                <div className="w-full">
                                    <div className="flex items-center">
                                        <h4 className="font-bold text-gray-900 text-lg mr-2">{review.reviewerName}</h4>
                                        {review.attachment && (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono border border-blue-200 flex items-center">
                                                <Paperclip className="w-3 h-3 mr-1"/> PDF Attached
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs font-mono text-gray-600">
                                        <div className="bg-gray-100 p-1 rounded px-2">Theoretical: <b>{review.ratings.theoretical || '-'}</b></div>
                                        <div className="bg-gray-100 p-1 rounded px-2">Empirical: <b>{review.ratings.empirical || '-'}</b></div>
                                        <div className="bg-gray-100 p-1 rounded px-2">Methodological: <b>{review.ratings.methodological || '-'}</b></div>
                                        <div className="bg-gray-100 p-1 rounded px-2">Breadth: <b>{review.ratings.breadth || '-'}</b></div>
                                        <div className="bg-gray-100 p-1 rounded px-2">Style: <b>{review.ratings.style || '-'}</b></div>
                                        <div className="bg-gray-100 p-1 rounded px-2">Suitability: <b>{review.ratings.suitability || '-'}</b></div>
                                    </div>
                                    
                                    <p className="text-xs text-gray-400 mt-2 italic truncate max-w-xl">
                                        "{review.title}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default App;
