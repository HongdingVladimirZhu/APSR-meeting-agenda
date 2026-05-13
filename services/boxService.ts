/**
 * Service to handle file uploads to the Box API.
 * Project Parent Folder ID: 339076223369
 */

const BOX_API_BASE = 'https://api.box.com/2.0';
const BOX_UPLOAD_URL = 'https://upload.box.com/api/2.0/files/content';
const PARENT_FOLDER_ID = '339076223369';

/**
 * Creates a folder in Box inside the target project folder.
 * Returns the ID of the created folder, or the ID of an existing folder if a conflict occurs.
 */
export const createBoxFolder = async (folderName: string, token: string): Promise<string> => {
  const response = await fetch(`${BOX_API_BASE}/folders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      parent: { id: PARENT_FOLDER_ID }
    })
  });

  const data = await response.json();

  if (response.ok) {
    return data.id;
  }

  // Handle conflict (folder already exists)
  if (response.status === 409 && data.context_info?.conflicts?.[0]?.id) {
    return data.context_info.conflicts[0].id;
  }

  throw new Error(data.message || 'Failed to create Box folder');
};

/**
 * Uploads a file to a specific folder in Box.
 */
export const uploadToBoxFolder = async (file: File | Blob, fileName: string, folderId: string, token: string): Promise<void> => {
  const formData = new FormData();
  
  // Box API requires attributes part for metadata
  const attributes = {
    name: fileName,
    parent: { id: folderId }
  };
  
  formData.append('attributes', JSON.stringify(attributes));
  formData.append('file', file);

  const response = await fetch(BOX_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle specific error for file name conflict (item_name_in_use)
    if (errorData.code === 'item_name_in_use') {
         // Optionally we could overwrite, but for now we throw
         throw new Error(`File "${fileName}" already exists in the folder.`);
    }
    throw new Error(errorData.message || `Upload failed for ${fileName}`);
  }
};