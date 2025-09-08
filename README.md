# Metadata Anonymity Checker Tool

The Metadata Anonymity Checker Tool is designed to assist researchers in ensuring the anonymity of their documents when submitting to academic conferences. This tool analyzes the metadata of various file types, including Word documents, Excel spreadsheets, PowerPoint presentations, PDFs, and images, highlighting any fields that could reveal the author's identity or affiliation. This tool is designed to perform checks locally on your machine rather than relying on third-party online services, ensuring that your paper remains confidential until it is officially published.

<img width="926" alt="metadata-checker-tool" src="https://github.com/user-attachments/assets/0e46f047-68e5-409c-bdb1-d3884905dfe9">

It is almost 2025, AI is everywhere, yet top-tier conferences like the ACM CHI Conference are still desk-rejecting papers because authors forgot to remove their identity from the metadata. Getting a paper rejected is tough, but it's even worse when it's rejected before review due to a small oversight like this.

Why hasn’t a feature been implemented to read file metadata during the upload process and alert authors? A metadata check during submission isn’t rocket science and could save both authors and reviewers time and effort. Automated checks should be in place to prevent these issues. It's unfair for authors to miss out on publication opportunities just because they forgot to anonymize file metadata.

Until such a feature exists, I’ve built this tool to help authors scan and fix metadata before submitting their papers!

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher) and npm.

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd metadata-anonymity-checker
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the server:**
    ```bash
    npm start
    ```
4.  **Access the application:**
    Open your browser and navigate to `http://localhost:3000`.

## How to Use

1.  Drag a file from your computer and drop it onto the upload area.
2.  Alternatively, click on the upload area to select a file from your computer.
3.  The tool will instantly analyze the file and display its metadata.
4.  A warning will be shown if any critical metadata fields (like author or company) are detected.

## Features

- **Local Processing**: All files are processed on your local machine, ensuring your data remains private and confidential.
- **Drag-and-Drop Interface**: Easily upload files using a simple drag-and-drop interface.
- **Wide Range of Supported Files**: Extracts metadata from various file types, including documents, spreadsheets, presentations, and images.
- **Critical Metadata Highlighting**: Automatically flags sensitive fields (e.g., author, creator) that could compromise anonymity.

## Supported File Types and Extracted Metadata

The tool extracts the following metadata from each supported file type:

- **General Information (All Files)**
  - `fileName`: The name of the file.
  - `fileSize`: The size of the file in megabytes (MB).
  - `fileType`: The MIME type of the file.

- **Documents (.docx, .pptx)**
  - `title`: The title of the document.
  - `author`: The author of the document.
  - `createdDate`: The date the document was created.
  - `modifiedDate`: The date the document was last modified.
  - `lastModifiedBy`: The person who last modified the document.

- **Spreadsheets (.xlsx)**
  - `title`: The title of the spreadsheet.
  - `author`: The author of the spreadsheet.
  - `createdDate`: The date the spreadsheet was created.
  - `modifiedDate`: The date the spreadsheet was last modified.
  - `lastModifiedBy`: The person who last modified the spreadsheet.

- **PDFs (.pdf)**
  - `author`: The author of the PDF.
  - `title`: The title of the PDF.
  - `creationDate`: The creation date of the PDF.
  - `modificationDate`: The modification date of the PDF.
  - `producer`: The software that created the PDF.
  - `creator`: The software that created the original document.

- **Images (.jpg, .jpeg, .png)**
  - `author`: The author or artist of the image.
  - `make`: The manufacturer of the camera.
  - `model`: The model of the camera.
  - `creationDate`: The date the image was taken.

## Contributing

Contributions are welcome! If you have suggestions or improvements, please create a pull request or open an issue in the repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool provides basic metadata checks, authors must ensure full compliance with anonymity and submission guidelines through thorough reviews before publishing.
