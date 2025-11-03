# Step-by-Step Guide: Using AI Summarize Workflow

## 📋 Complete Workflow Setup & Execution

---

## **STEP 1: Get Your Gemini API Key** 🔑

### 1.1 Go to Google AI Studio
- Open: https://aistudio.google.com/app/apikey
- Sign in with your Google account

### 1.2 Create API Key
- Click **"Create API key"** button
- Select **"Create new secret key in new project"**
- Copy the API key (keep it safe!)

### 1.3 Verify API Key Works
- Go to: https://aistudio.google.com/app/apikey
- You should see your key listed
- ✅ Ready to use!

---

## **STEP 2: Create Canvas Elements** 🎨

### 2.1 Add FILE_UPLOAD Element
1. Open your app in **Canvas Editor**
2. Go to **Element Library** (left panel)
3. Find **"File Upload"** or **"Upload"** element
4. Drag it onto the canvas
5. Position it where you want
6. Note the element ID (visible in properties panel)

**Example:**
```
Element Name: File Upload
Element Type: FILE_UPLOAD
Element ID: file-upload-1
```

### 2.2 Add Display Elements (Optional)
- Add a **TEXT** element to show summary
- Add a **BUTTON** to trigger the workflow
- Position them nicely

---

## **STEP 3: Create the Workflow** 🔄

### 3.1 Open Workflow Builder
1. Go to **Workflows** section
2. Click **"Create New Workflow"**
3. Give it a name: `"Summarize Document"`

### 3.2 Add Trigger Block
1. In **Block Library**, find **Triggers** section
2. Drag **"onSubmit"** block (or **"onClick"** if using a button)
3. Configure:
   - **Form Group**: Select your form (if using onSubmit)
   - **OR Element**: Select your button (if using onClick)

### 3.3 Add AI Summarize Block
1. In **Block Library**, find **AI Blocks** section
2. Drag **"ai.summarize"** block (Sparkles icon ✨)
3. Connect it to the trigger block (blue connector)

### 3.4 Configure AI Summarize Block
1. Click the **gear icon** on ai.summarize block
2. **File Upload Element**: 
   - Click dropdown
   - Select your FILE_UPLOAD element
   - Example: `File Upload (FILE_UPLOAD) - Page 1`
3. **Gemini API Key**:
   - Paste your API key from Step 1
   - It's a password field (hidden)
4. **Output Variable** (optional):
   - Default: `aiSummary`
   - Change if needed
5. Click **Save**

### 3.5 Add Notification Block (Optional)
1. Drag **"notify.toast"** block
2. Connect it to ai.summarize block
3. Configure:
   - **Message**: `Summary generated! Check the popup.`
   - **Type**: Success
4. Click **Save**

### 3.6 Save Workflow
1. Click **"Save Workflow"** button
2. Verify it's saved (no asterisk in title)

---

## **STEP 4: Test in Preview Mode** 🧪

### 4.1 Enter Preview Mode
1. Go to **Canvas Editor**
2. Click **"Preview"** button (top right)
3. You should see your app in preview mode

### 4.2 Upload a File
1. Click on the **FILE_UPLOAD** element
2. Select a file:
   - **PDF** (e.g., document.pdf)
   - **DOCX** (e.g., report.docx)
   - **TXT** (e.g., notes.txt)
3. File is uploaded

### 4.3 Trigger the Workflow
1. Click the **button** or **submit** to trigger workflow
2. Wait for processing (may take 5-10 seconds)
3. Look for:
   - ✅ Toast notification: "Summary generated!"
   - ✅ Summary popup appears
   - ✅ Summary text visible

### 4.4 View Summary
- **Summary Popup** shows:
  - Summary text
  - Original file size
  - Summary size
  - Compression ratio
  - File name
- **Copy Button**: Copy summary to clipboard
- **Download Button**: Download as .txt file

---

## **STEP 5: Troubleshooting** 🔧

### Issue: "No FILE_UPLOAD elements found"
**Solution:**
- Make sure FILE_UPLOAD element is on the canvas
- Refresh the workflow builder
- Try adding element again

### Issue: "Invalid API key"
**Solution:**
- Go to https://aistudio.google.com/app/apikey
- Verify API key is correct
- Create a new key if needed
- Update the workflow configuration

### Issue: "File not found in context"
**Solution:**
- Make sure file is uploaded BEFORE triggering workflow
- Check that FILE_UPLOAD element is selected in dropdown
- Verify element ID matches

### Issue: "Unsupported file type"
**Solution:**
- Only PDF, DOCX, TXT files are supported
- Convert your file to one of these formats
- Try uploading again

### Issue: "No text content found"
**Solution:**
- File might be empty or corrupted
- Try a different file
- Verify file has readable text content

---

## **STEP 6: Advanced Usage** 🚀

### 6.1 Use Summary in Other Blocks
After ai.summarize block, you can:
1. Add **db.create** block to save summary
2. Add **http.request** to send summary to API
3. Add **page.redirect** to go to results page

**Example:**
```
onSubmit → ai.summarize → db.create
                              ↓
                        Save summary to database
```

### 6.2 Access Summary in Context
Use `{{context.aiSummary.text}}` to:
- Display in text element
- Send in email
- Store in database
- Pass to other blocks

### 6.3 Multiple Files
1. Add multiple FILE_UPLOAD elements
2. Create separate ai.summarize blocks for each
3. Connect them in sequence

---

## **STEP 7: Production Deployment** 🌐

### 7.1 Before Going Live
- ✅ Test with various file types
- ✅ Test with large files (up to 50MB)
- ✅ Verify API key is secure
- ✅ Test error scenarios

### 7.2 Deploy
1. Go to **Deploy** section
2. Click **"Deploy to Production"**
3. Verify deployment successful
4. Test in production environment

### 7.3 Monitor Usage
- Check Gemini API usage: https://aistudio.google.com/app/apikey
- Monitor file upload sizes
- Track summarization performance

---

## **📊 Workflow Diagram**

```
┌─────────────────┐
│  FILE_UPLOAD    │
│   (User)        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   onSubmit      │ (Trigger)
│   or onClick    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  ai.summarize   │ (Process)
│  (Gemini API)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  notify.toast   │ (Feedback)
│  (Optional)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Summary Popup   │ (Display)
│ (User sees it)  │
└─────────────────┘
```

---

## **✅ Checklist**

- [ ] Got Gemini API key
- [ ] Added FILE_UPLOAD element to canvas
- [ ] Created workflow
- [ ] Added ai.summarize block
- [ ] Configured with API key and element
- [ ] Tested in preview mode
- [ ] Verified summary appears
- [ ] Tested with different file types
- [ ] Ready for production!

---

## **🎉 You're All Set!**

Your ai.summarize workflow is ready to use. Follow these steps and you'll have document summarization working in your app!

**Need help?** Check the troubleshooting section or review the configuration steps.

