# Metadata Anonymity Checker Tool

The Metadata Anonymity Checker Tool is designed to assist researchers in ensuring the anonymity of their documents when submitting to academic conferences. This tool analyzes the metadata of various file types, including Word documents, Excel spreadsheets, PowerPoint presentations, PDFs, and images, highlighting any fields that could reveal the author's identity or affiliation. This tool is designed to perform checks locally on your machine rather than relying on third-party online services, ensuring that your paper remains confidential until it is officially published.

<img width="926" alt="metadata-checker-tool" src="https://github.com/user-attachments/assets/0e46f047-68e5-409c-bdb1-d3884905dfe9">

It is almost 2025, AI is everywhere, yet top-tier conferences like the ACM CHI Conference are still desk-rejecting papers because authors forgot to remove their identity from the metadata. Getting a paper rejected is tough, but it's even worse when it's rejected before review due to a small oversight like this.

Why hasn’t a feature been implemented to read file metadata during the upload process and alert authors? A metadata check during submission isn’t rocket science and could save both authors and reviewers time and effort. Automated checks should be in place to prevent these issues. It's unfair for authors to miss out on publication opportunities just because they forgot to anonymize file metadata.

Until such a feature exists, I’ve built this tool to help authors scan and fix metadata before submitting their papers!

## Prerequisites

- Node.js (version 14 or higher)
- Learn how to install [Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)

## Installation

1. **Clone the repository**

2. **Install dependencies:**
   ```
   cd metadata-anonymity-checker
   npm install
   ```

## Running the Application

1. Start the server:
   ```npm start```

2. Open your browser and navigate to `http://localhost:3000`

## Contributing

Contributions are welcome! If you have suggestions or improvements, please create a pull request or open an issue in the repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool provides basic metadata checks, authors must ensure full compliance with anonymity and submission guidelines through thorough reviews before publishing.
