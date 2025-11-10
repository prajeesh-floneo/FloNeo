# Testing AI Summarize Block - Complete Guide

## 🎯 Overview

This guide provides comprehensive testing instructions for the new `ai.summarize` workflow block in FloNeo.

**Status**: ✅ Implementation Complete - Ready for Testing

---

## 📋 Prerequisites

1. ✅ FloNeo application running at http://localhost:3000
2. ✅ Backend server running at http://localhost:5000
3. ✅ Logged in to FloNeo
4. ✅ Google Gemini API key (get from https://aistudio.google.com/app/apikey)
5. ✅ Browser console open (Press F12)
6. ✅ Test files ready (TXT, PDF, DOCX)

---

## 🧪 Test 1: UI Configuration Panel

### Goal
Verify that the ai.summarize block configuration panel works correctly.

### Steps

1. **Open Workflow Builder**
   - Navigate to http://localhost:3000/workflow-builder
   - Create a new workflow

2. **Add ai.summarize Block**
   - Drag "ai.summarize" from AI Blocks category
   - Click the gear icon to open configuration

3. **Verify Configuration Panel**
   - ✅ File Variable input field appears
   - ✅ API Key password field appears
   - ✅ Output Variable input field appears (defaults to "aiSummary")
   - ✅ Info box explains how the block works
   - ✅ Link to Google AI Studio is clickable

4. **Fill Configuration**
   - File Variable: `uploadedFile`
   - API Key: Paste your Gemini API key
   - Output Variable: `aiSummary` (or custom name)

5. **Verify Status**
   - ✅ Green checkmark appears on block icon (configured)
   - ✅ Configuration persists when modal closes

---

## 🧪 Test 2: File Upload Integration

### Goal
Verify that uploaded files are properly passed to ai.summarize block.

### Steps

1. **Create Workflow with File Upload**
   - Add FILE_UPLOAD element to canvas
   - Add ai.summarize block to workflow
   - Connect FILE_UPLOAD trigger to ai.summarize

2. **Configure Blocks**
   - FILE_UPLOAD: Accept .txt, .pdf, .docx files
   - ai.summarize: Set fileVariable to `uploadedFile`

3. **Test Upload**
   - Upload a small TXT file (< 1MB)
   - Verify file appears in database (check server logs)
   - Check console for: `✅ File uploaded successfully`

---

## 🧪 Test 3: Text Extraction

### Goal
Verify text extraction works for different file types.

### Test Cases

#### 3.1: TXT File
- **File**: Simple text document
- **Expected**: Full text extracted
- **Check**: Console shows `✅ Text extracted successfully`

#### 3.2: PDF File
- **File**: PDF with text content
- **Expected**: Text extracted from PDF
- **Check**: No errors in console

#### 3.3: DOCX File
- **File**: Word document
- **Expected**: Text extracted from DOCX
- **Check**: No errors in console

#### 3.4: Unsupported File
- **File**: Image file (.jpg, .png)
- **Expected**: Error message
- **Check**: Console shows `❌ Unsupported file type`

---

## 🧪 Test 4: AI Summarization

### Goal
Verify Gemini API integration and summarization.

### Steps

1. **Upload Test Document**
   - Use provided test document (500+ words)
   - Verify file uploads successfully

2. **Trigger Workflow**
   - Click button to execute workflow
   - Watch for loading spinner on canvas

3. **Verify Summary Popup**
   - ✅ Popup appears with summary
   - ✅ Summary is shorter than original
   - ✅ Metadata shows compression ratio
   - ✅ Copy button works
   - ✅ Download button creates .txt file

4. **Check Console**
   - ✅ `✨ [WF-RUN] Displaying AI summary`
   - ✅ No errors in console

---

## 🧪 Test 5: File Size Limits

### Goal
Verify 50MB file size limit is enforced.

### Test Cases

#### 5.1: Small File (< 1MB)
- **Expected**: ✅ Uploads successfully

#### 5.2: Medium File (10-20MB)
- **Expected**: ✅ Uploads successfully

#### 5.3: Large File (40-50MB)
- **Expected**: ✅ Uploads successfully

#### 5.4: Oversized File (> 50MB)
- **Expected**: ❌ Upload rejected
- **Check**: Error message appears

---

## 🧪 Test 6: Error Handling

### Goal
Verify proper error handling and user feedback.

### Test Cases

#### 6.1: Invalid API Key
- **Setup**: Use fake API key
- **Expected**: Error toast appears
- **Check**: Console shows `❌ Invalid API key`

#### 6.2: Network Error
- **Setup**: Disconnect internet during summarization
- **Expected**: Error toast appears
- **Check**: Graceful error handling

#### 6.3: Empty File
- **Setup**: Upload empty text file
- **Expected**: Error message
- **Check**: `No text content found`

#### 6.4: Missing File Variable
- **Setup**: Don't configure fileVariable
- **Expected**: Validation error
- **Check**: Yellow warning badge on block

---

## 🧪 Test 7: Context Variables

### Goal
Verify summary is stored in context correctly.

### Steps

1. **Create Multi-Block Workflow**
   - ai.summarize → notify.toast

2. **Configure notify.toast**
   - Message: `Summary: {{context.aiSummary}}`

3. **Execute Workflow**
   - Upload file and trigger workflow
   - Verify toast shows summary text

4. **Check Context**
   - Console should show context propagation
   - Summary available to subsequent blocks

---

## 🧪 Test 8: Database Tracking

### Goal
Verify file metadata is stored in database.

### Steps

1. **Upload and Summarize**
   - Complete full workflow

2. **Check Database**
   ```sql
   SELECT * FROM MediaFile WHERE filename = 'your-file.txt';
   ```

3. **Verify Metadata**
   - ✅ `summarized: true`
   - ✅ `summaryLength` recorded
   - ✅ `summarizedAt` timestamp

---

## 📊 Test Results Template

```
Test Date: ___________
Tester: ___________
API Key: ___________

[ ] Test 1: UI Configuration Panel - PASS/FAIL
[ ] Test 2: File Upload Integration - PASS/FAIL
[ ] Test 3: Text Extraction - PASS/FAIL
[ ] Test 4: AI Summarization - PASS/FAIL
[ ] Test 5: File Size Limits - PASS/FAIL
[ ] Test 6: Error Handling - PASS/FAIL
[ ] Test 7: Context Variables - PASS/FAIL
[ ] Test 8: Database Tracking - PASS/FAIL

Overall Status: ___________
Issues Found: ___________
```

---

## 🐛 Troubleshooting

### Issue: "Invalid API Key"
- **Solution**: Verify API key from https://aistudio.google.com/app/apikey
- **Check**: API key is not expired

### Issue: "File not found"
- **Solution**: Ensure file was uploaded successfully
- **Check**: File exists in `server/uploads/` directory

### Issue: "Unsupported file type"
- **Solution**: Only PDF, DOCX, TXT are supported
- **Check**: File MIME type is correct

### Issue: "No text content found"
- **Solution**: File may be corrupted or empty
- **Check**: Try with different file

### Issue: Popup doesn't appear
- **Solution**: Check browser console for errors
- **Check**: Workflow executed successfully (check logs)

---

## ✅ Success Criteria

All tests pass when:
- ✅ Configuration panel displays correctly
- ✅ Files upload successfully
- ✅ Text extraction works for all file types
- ✅ Summarization produces meaningful results
- ✅ Summary popup displays with metadata
- ✅ Error handling is graceful
- ✅ Context variables propagate correctly
- ✅ Database records are created

---

## 📝 Notes

- Keep API key secure - never commit to repository
- Test with various document types and sizes
- Monitor API usage and costs
- Check server logs for detailed execution info

