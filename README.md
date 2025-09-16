
<img width="877" height="321" alt="presub" src="https://github.com/user-attachments/assets/59aeedb3-ed22-4eeb-9ad9-12f7ee9ce879" />

PreSub helps you scan documents locally for identifying anonymity issues before you submit or share them. It highlights authoring details like Author, Creator, and Last Modified By, along with other useful properties such as page/slide counts and creation/modification dates — all processed in your browser with no uploads.

All file parsing runs entirely on your device. No files or metadata leave your browser.

**Capabilities**
- **Local-only processing**: No files or metadata are sent to a server.
- **Issue highlighting**: Flags common anonymity risks — Author, Creator, Last Modified By.
- **Rich metadata**: Extracts counts (pages, slides, sheets, word count), dates, titles, subjects, software, company, and more when available.
- **Multiple formats**: Works with PDFs, Office (Word, Excel, PowerPoint), and common image formats.
- **Batch support**: Drop multiple files and review results together; clear results anytime.

**Supported Formats**
- **PDF**: page count, Title, Author, Subject, Creator, Producer, Creation/Modification dates.
- **DOCX** (Word): author, creator, lastModifiedBy, wordCount, title, subject, description, keywords, category, creation/modification dates, company/manager/application where available.
- **XLSX** (Excel): sheet names/count, Title, Author, Subject, Creator, Company, Last Modified By, Creation/Modification dates.
- **PPTX** (PowerPoint): author, creator, lastModifiedBy, slides, title, dates, and related app metadata.
- **Images**: JPEG, PNG, SVG, TIFF — parses EXIF/XMP/text chunks to surface author/creator, title, description, software, copyright, and dates when present.

**How It Works**
- **Dropzone UI**: Drag-and-drop or click to select files; supported types are listed and legacy formats are rejected with guidance.

**What it does not do**: PreSub does not edit or scrub files; it only reports what it finds so you can fix issues using your preferred tools.

**Limitations**
- **Read-only**: PreSub reports metadata but does not modify files.
- **Coverage**: Metadata availability varies by file and toolchain; some fields may be missing or stored in proprietary places.
- **Legacy formats**: `.doc`, `.xls`, `.ppt` are not parsed; convert to modern formats first.

## Contributing

Contributions are welcome! If you have suggestions or improvements, please create a pull request or open an issue in the repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool provides basic metadata checks, authors must ensure full compliance with anonymity and submission guidelines through thorough reviews before publishing.
