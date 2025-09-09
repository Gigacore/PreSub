"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeFile = analyzeFile;
exports.sanitizeFile = sanitizeFile;
const jszip_1 = __importDefault(require("jszip"));
const xml2js_1 = require("xml2js");
async function analyzeFile(buf, mime, name) {
    console.log('Starting file analysis...');
    const result = {
        critical: [],
        warning: [],
        info: [],
    };
    try {
        console.log('Loading with JSZip...');
        const zip = await jszip_1.default.loadAsync(buf);
        console.log('JSZip loading complete.');
        const corePropsXml = await zip.file('docProps/core.xml')?.async('string');
        if (corePropsXml) {
            const coreProps = await (0, xml2js_1.parseStringPromise)(corePropsXml, {
                explicitArray: false,
                tagNameProcessors: [tag => tag.replace('cp:', '')],
            });
            const properties = coreProps.coreProperties;
            if (properties) {
                const creator = properties['dc:creator'];
                if (creator) {
                    result.critical.push({
                        id: 'author',
                        description: 'The author of the document.',
                        value: creator,
                    });
                }
                const lastModifiedBy = properties.lastModifiedBy;
                if (lastModifiedBy) {
                    result.warning.push({
                        id: 'lastModifiedBy',
                        description: 'The person who last modified the document.',
                        value: lastModifiedBy,
                    });
                }
            }
        }
    }
    catch (error) {
        console.error('Error analyzing file:', error);
        // For now, we just ignore errors and return an empty result.
        // In the future, we might want to return an error message.
    }
    return result;
}
async function sanitizeFile(buf, opts) {
    // TODO: Implement sanitization logic
    return buf;
}
