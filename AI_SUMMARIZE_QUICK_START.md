# AI Summarize - Quick Start (5 Minutes)

## ⚡ Quick Setup

### 1️⃣ Get API Key (1 min)
```
https://aistudio.google.com/app/apikey
→ Create API key
→ Copy it
```

### 2️⃣ Add FILE_UPLOAD Element (1 min)
```
Canvas Editor
→ Element Library
→ Drag "File Upload" to canvas
→ Note the element ID
```

### 3️⃣ Create Workflow (2 min)
```
Workflows
→ Create New Workflow
→ Add "onSubmit" trigger
→ Add "ai.summarize" block
→ Connect them
```

### 4️⃣ Configure AI Summarize (1 min)
```
Click gear icon on ai.summarize block
→ File Upload Element: Select from dropdown
→ Gemini API Key: Paste your key
→ Output Variable: aiSummary (default)
→ Save
```

### 5️⃣ Test (Optional)
```
Canvas Editor
→ Preview
→ Upload file
→ Click submit
→ See summary popup!
```

---

## 🎯 Configuration Checklist

| Step | What | Where | Status |
|------|------|-------|--------|
| 1 | Get API Key | https://aistudio.google.com/app/apikey | ☐ |
| 2 | Add FILE_UPLOAD | Canvas Editor | ☐ |
| 3 | Create Workflow | Workflows section | ☐ |
| 4 | Add Trigger | Block Library → Triggers | ☐ |
| 5 | Add ai.summarize | Block Library → AI Blocks | ☐ |
| 6 | Select File Element | Dropdown in config | ☐ |
| 7 | Paste API Key | Config panel | ☐ |
| 8 | Save Workflow | Save button | ☐ |
| 9 | Test | Preview mode | ☐ |

---

## 📁 Supported File Types

✅ **PDF** - `.pdf`
✅ **Word** - `.docx`
✅ **Text** - `.txt`

❌ **Not Supported** - Images, videos, audio, etc.

---

## 📊 File Size Limits

- **Max file size**: 50 MB
- **Recommended**: 1-10 MB for best performance
- **Processing time**: 5-30 seconds depending on size

---

## 🔑 API Key Tips

- **Free tier**: 15 requests per minute
- **Keep it secret**: Don't share your API key
- **Monitor usage**: https://aistudio.google.com/app/apikey
- **Rate limited?** Wait a minute and try again

---

## 🎨 Workflow Structure

```
Trigger (onSubmit/onClick)
         ↓
    ai.summarize
         ↓
   notify.toast (optional)
         ↓
  Summary Popup
```

---

## 💡 Common Use Cases

### 📄 Document Summarization
```
User uploads PDF
→ Workflow triggers
→ AI summarizes content
→ User sees summary
```

### 📝 Report Analysis
```
Upload report.docx
→ Get key points
→ Save to database
→ Send via email
```

### 🔍 Content Review
```
Upload document
→ Get summary
→ Review quickly
→ Approve/reject
```

---

## ⚠️ Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "No FILE_UPLOAD elements found" | Add FILE_UPLOAD to canvas |
| "Invalid API key" | Check key at aistudio.google.com |
| "File not found in context" | Make sure file is uploaded first |
| "Unsupported file type" | Use PDF, DOCX, or TXT |
| "No text content found" | File might be empty or corrupted |

---

## 🚀 Next Steps

1. **Test with sample files**
   - Try PDF, DOCX, TXT
   - Test different sizes

2. **Integrate with other blocks**
   - Save summary to database
   - Send in email
   - Display on page

3. **Deploy to production**
   - Test thoroughly
   - Monitor API usage
   - Set up error handling

---

## 📞 Support

**Need help?**
- Check `STEP_BY_STEP_AI_SUMMARIZE_WORKFLOW.md` for detailed guide
- Review troubleshooting section
- Check API key at https://aistudio.google.com/app/apikey

---

## ✨ Features

✅ Automatic text extraction from documents
✅ AI-powered summarization using Gemini 1.5 Pro
✅ Compression ratio calculation
✅ Copy to clipboard
✅ Download as text file
✅ Error handling and validation
✅ Works with multiple file types
✅ Supports large files (up to 50MB)

---

**Ready to summarize? Start with Step 1! 🎉**

