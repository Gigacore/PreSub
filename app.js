const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const exifParser = require('exif-parser');

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Serve static assets (like CSS from public folder)
app.use(express.static('public'));

// Helper function to extract metadata from .docx and .pptx files
async function extractOfficeMetadata(filePath) {
    const zip = new JSZip();
    const data = fs.readFileSync(filePath);
    const content = await zip.loadAsync(data);

    if (!content.files['docProps/core.xml']) {
        throw new Error('Metadata not found in file');
    }

    const coreXml = await content.files['docProps/core.xml'].async('string');
    const parser = new xml2js.Parser();
    const parsedXml = await parser.parseStringPromise(coreXml);

    const metadata = {
        title: parsedXml['cp:coreProperties']['dc:title'][0],
        author: parsedXml['cp:coreProperties']['dc:creator'][0],
        createdDate: parsedXml['cp:coreProperties']['dcterms:created'][0]._,
        modifiedDate: parsedXml['cp:coreProperties']['dcterms:modified'][0]._,
        lastModifiedBy: parsedXml['cp:coreProperties']['cp:lastModifiedBy'][0],
    };

    return metadata;
}

// Route to serve the main page with the drag-and-drop area
app.get('/', (req, res) => {
    res.render('index', { metadata: null, warning: false });
});

// Handle file uploads and metadata extraction
app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const filePath = path.join(__dirname, file.path);
    const ext = path.extname(file.originalname).toLowerCase();

    try {
        let metadata = {
            fileName: file.originalname,
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB', // Convert bytes to MB and display with 2 decimal places
            fileType: file.mimetype,
        };

        let warning = false; // To track if any critical fields are detected
        const criticalFields = ['author', 'lastModifiedBy', 'producer', 'creator'];

        if (ext === '.docx' || ext === '.pptx') {
            // Extract metadata for Word and PowerPoint files
            const officeMetadata = await extractOfficeMetadata(filePath);
            metadata = { ...metadata, ...officeMetadata };

        } else if (ext === '.xlsx') {
            // Extract metadata for Excel files using xlsx
            const workbook = xlsx.readFile(filePath);
            const props = workbook.Props;
            metadata = {
                ...metadata,
                title: props.Title,
                author: props.Author,
                createdDate: props.CreatedDate,
                modifiedDate: props.ModifiedDate,
                lastModifiedBy: props.LastAuthor,
            };

        } else if (ext === '.pdf') {
            // Extract metadata for PDF files using pdf-parse
            const data = await pdfParse(fs.readFileSync(filePath));
            metadata = {
                ...metadata,
                author: data.info.Author,
                title: data.info.Title,
                creationDate: data.info.CreationDate,
                modificationDate: data.info.ModDate,
                producer: data.info.Producer,
                creator: data.info.Creator,
            };

        } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
            // Extract EXIF metadata for image files
            const buffer = fs.readFileSync(filePath);
            const parser = exifParser.create(buffer);
            const result = parser.parse();
            metadata = {
                ...metadata,
                author: result.tags.Artist || 'N/A',
                make: result.tags.Make || 'N/A',
                model: result.tags.Model || 'N/A',
                creationDate: result.tags.CreateDate || 'N/A',
            };

        } else {
            metadata.error = "Unsupported file type";
            return res.status(400).json({ success: false, metadata });
        }

        // Check for critical fields in metadata
        Object.keys(metadata).forEach(key => {
            if (criticalFields.includes(key.toLowerCase()) && metadata[key]) {
                warning = true;
            }
        });

        // Sort critical fields at the top
        const sortedMetadata = Object.keys(metadata)
            .sort((a, b) => {
                const aIsCritical = criticalFields.includes(a.toLowerCase());
                const bIsCritical = criticalFields.includes(b.toLowerCase());
                return aIsCritical === bIsCritical ? 0 : aIsCritical ? -1 : 1;
            })
            .reduce((obj, key) => {
                obj[key] = metadata[key];
                return obj;
            }, {});

        // Render the result in the template
        res.render('index', { metadata: sortedMetadata, warning });

    } catch (err) {
        res.status(500).json({ success: false, message: 'Error processing file', error: err.message });
    } finally {
        // Clean up the file after processing
        fs.unlinkSync(filePath);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
