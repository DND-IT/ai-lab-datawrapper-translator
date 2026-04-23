import * as dw from '../services/datawrapper.js';
import { getDeeplDictionary } from '../services/deepl.js';
export class Chart {
    chartId;
    metadata = null;
    chartType;
    dataTable = null;
    experimentalMode;
    constructor(chartId, chartType = '', experimentalMode = false) {
        this.chartId = chartId;
        this.chartType = chartType;
        this.experimentalMode = experimentalMode;
    }
    async fetchMetadata() {
        if (!this.metadata) {
            this.metadata = await dw.getMeta(this.chartId);
        }
        return this.metadata;
    }
    getTextAnnotations() {
        if (!this.metadata)
            return false;
        if (!this.metadata.visualize) {
            console.log('WARNING: "visualize" not found in metadata');
            return false;
        }
        return this.metadata.visualize['text-annotations'] || false;
    }
    async fetchDataTable() {
        if (!this.dataTable) {
            this.dataTable = await dw.getChartTable(this.chartId, this.metadata);
        }
        return this.dataTable;
    }
    async createTranslationTable(sourceLang, targetLang) {
        try {
            const sourceTextDict = await dw.getChartTexts(this.chartId);
            // For bar charts, also translate the labels
            if (this.chartType === 'd3-bars') {
                const table = await this.fetchDataTable();
                table.labels.forEach((label, i) => {
                    sourceTextDict[`label-${i + 1}`] = label;
                });
            }
            // Translate text annotations
            await this.fetchMetadata();
            const annotations = this.getTextAnnotations();
            if (annotations && Array.isArray(annotations)) {
                console.log(annotations);
                annotations.forEach((ann, i) => {
                    sourceTextDict[`annotation-${i + 1}`] = ann.text;
                });
                console.log(sourceTextDict);
            }
            const sourceTextList = Object.values(sourceTextDict);
            const translationsDict = await getDeeplDictionary(sourceTextList, sourceLang, targetLang);
            console.log('Translations:', translationsDict);
            return Object.entries(sourceTextDict).map(([key, sourceText]) => ({
                key,
                source: sourceText,
                translation: translationsDict[sourceText] || '',
            }));
        }
        catch (e) {
            console.error('Exception:', e);
            return false;
        }
    }
    async applyTranslations(translations, targetLang) {
        const dwLang = targetLang === 'FR' ? 'fr-CH' : 'de-CH';
        // translations is [keys[], sources[], translations[]]
        const translatedItems = {};
        for (let i = 0; i < translations[0].length; i++) {
            translatedItems[translations[0][i]] = translations[2][i];
        }
        const metadata = await this.fetchMetadata();
        const patchPayload = {
            language: dwLang,
            metadata,
        };
        if (translatedItems.title) {
            patchPayload.title = translatedItems.title;
        }
        if (translatedItems.intro) {
            patchPayload.metadata.describe.intro = translatedItems.intro;
        }
        if (translatedItems['bottom-note']) {
            patchPayload.metadata.annotate.notes = translatedItems['bottom-note'];
        }
        if (translatedItems.source) {
            patchPayload.metadata.describe['source-name'] = translatedItems.source;
        }
        // Annotations
        if (translatedItems['annotation-1']) {
            const annotations = this.getTextAnnotations();
            if (annotations && Array.isArray(annotations)) {
                const translatedAnnotations = Object.entries(translatedItems)
                    .filter(([key]) => key.startsWith('annotation-'))
                    .map(([, value]) => value);
                if (annotations.length === translatedAnnotations.length) {
                    for (let i = 0; i < annotations.length; i++) {
                        annotations[i].text = translatedAnnotations[i];
                    }
                    patchPayload.metadata.visualize['text-annotations'] = annotations;
                }
            }
            else {
                console.error('ERROR: could not retrieve annotations again.');
            }
        }
        // Bar chart labels
        if (translatedItems['label-1']) {
            const translatedLabels = Object.entries(translatedItems)
                .filter(([key]) => key.startsWith('label-'))
                .map(([, value]) => value);
            const table = await this.fetchDataTable();
            if (table.labels.length === translatedLabels.length) {
                const newCsv = dw.buildCsvWithNewLabels(table.rawCsv, table.metadata, translatedLabels);
                await dw.putChartDataEncoded(this.chartId, newCsv);
            }
            else {
                console.log('Could not match translated labels with current labels');
            }
        }
        return await dw.patchChartMeta(this.chartId, patchPayload);
    }
}
