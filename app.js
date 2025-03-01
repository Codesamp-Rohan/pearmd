import { marked } from 'marked'


document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const markdownInput = document.getElementById('markdown-input');
  const previewPane = document.getElementById('preview-pane');
  const copyButton = document.getElementById('copy-button');
  const saveButton = document.getElementById('save-button');
  const clearButton = document.getElementById('clear-button');
  const toast = document.getElementById('toast');

  // Initialize with sample markdown
  const sampleMarkdown = `# Welcome to Elegant Markdown Editor

## Getting Started

This is a simple, elegant markdown editor. Type in the left pane and see the formatted result on the right.

### Features

- **Live Preview**: See your changes in real-time
- **Clean Design**: Focused on readability and simplicity
- **Copy HTML**: Export your markdown as HTML
- **Save**: Download your work as a markdown file

## Markdown Examples

### Text Formatting

*Italic text* and **bold text**

### Lists

- Item 1
- Item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2

### Code

Inline \`code\` looks like this.

\`\`\`javascript
// Code block
function greet() {
  console.log("Hello, world!");
}
\`\`\`

### Blockquotes

> This is a blockquote.
> It can span multiple lines.

### Links and Images

[Example link](https://example.com)

![Alt text for an image](https://images.unsplash.com/photo-1518099074172-2e47ee6cfdc0?auto=format&fit=crop&w=600&q=80)

### Tables

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

---

Start typing now to create your own markdown document!`;

  markdownInput.value = sampleMarkdown;

  // Functions
  function updatePreview() {
    // Render markdown to HTML using marked library
    previewPane.innerHTML = marked.parse(markdownInput.value);

    // Add target="_blank" to all links for security
    const links = previewPane.querySelectorAll('a');
    links.forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function copyHtml() {
    const htmlContent = previewPane.innerHTML;
    navigator.clipboard.writeText(htmlContent)
      .then(() => showToast('HTML copied to clipboard!'))
      .catch(err => showToast('Failed to copy HTML'));
  }

  function saveMarkdown() {
    const markdown = markdownInput.value;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();

    URL.revokeObjectURL(url);
    showToast('Markdown file saved!');
  }

  function clearEditor() {
    if (confirm('Are you sure you want to clear the editor? All unsaved changes will be lost.')) {
      markdownInput.value = '';
      updatePreview();
      showToast('Editor cleared');
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Event Listeners
  markdownInput.addEventListener('input', updatePreview);
  copyButton.addEventListener('click', copyHtml);
  saveButton.addEventListener('click', saveMarkdown);
  clearButton.addEventListener('click', clearEditor);

  // Initialize preview
  updatePreview();

  // Add smooth animation when the editor loads
  setTimeout(() => {
    document.body.style.opacity = '1';
  }, 100);

  // Add lazy loading for images in the preview
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.dataset.src) {
        entry.target.src = entry.target.dataset.src;
        entry.target.removeAttribute('data-src');
        observer.unobserve(entry.target);
      }
    });
  });

  // Function to process images after markdown is rendered
  function setupLazyLoading() {
    const images = previewPane.querySelectorAll('img');
    images.forEach(img => {
      if (img.src) {
        img.dataset.src = img.src;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
        observer.observe(img);
      }
    });
  }

  // Re-process images when preview is updated
  const originalUpdatePreview = updatePreview;
  updatePreview = function() {
    originalUpdatePreview();
    setupLazyLoading();
  };

  // Initial setup
  setupLazyLoading();

  // Save markdown to localStorage periodically for auto-recovery
  setInterval(() => {
    localStorage.setItem('savedMarkdown', markdownInput.value);
  }, 5000);

  // Try to load from localStorage on startup
  const savedMarkdown = localStorage.getItem('savedMarkdown');
  if (savedMarkdown) {
    markdownInput.value = savedMarkdown;
    updatePreview();
  }
});
