import { config } from '../config.js';
import { checkStatus, getCurrentDate } from '../helpers.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DW_API_URL = 'https://api.datawrapper.de/v3/charts/';
function headers(accept = '*/*') {
    return { accept, Authorization: `Bearer ${config.dwApiToken}` };
}
function jsonHeaders() {
    return { ...headers('application/json'), 'Content-Type': 'application/json' };
}
// --- Metadata ---
export async function getMeta(chartId) {
    const res = await fetch(`${DW_API_URL}${chartId}`, { headers: headers('application/json') });
    const data = await res.json();
    return data.metadata;
}
export async function getChartTable(chartId, metadata) {
    if (!metadata)
        metadata = await getMeta(chartId);
    const res = await fetch(`${DW_API_URL}${chartId}/data`, { headers: headers('text/csv') });
    await checkStatus(res);
    const rawCsv = await res.text();
    const firstLine = rawCsv.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const sep = tabCount > commaCount ? '\t' : ',';
    const hasHeader = !!metadata?.data?.['vertical-header'];
    const lines = rawCsv.trim().split('\n').filter(l => l.length > 0);
    const startIdx = hasHeader ? 1 : 0;
    const labels = lines.slice(startIdx).map(line => {
        const sepIdx = line.indexOf(sep);
        return sepIdx >= 0 ? line.substring(0, sepIdx) : line;
    });
    return { labels, rawCsv, metadata };
}
export function buildCsvWithNewLabels(rawCsv, metadata, newLabels) {
    const firstLine = rawCsv.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const sep = tabCount > commaCount ? '\t' : ',';
    const hasHeader = !!metadata?.data?.['vertical-header'];
    const lines = rawCsv.trim().split('\n');
    const startIdx = hasHeader ? 1 : 0;
    for (let i = 0; i < newLabels.length; i++) {
        const lineIdx = i + startIdx;
        if (lineIdx < lines.length) {
            const sepIdx = lines[lineIdx].indexOf(sep);
            if (sepIdx >= 0) {
                lines[lineIdx] = newLabels[i] + lines[lineIdx].substring(sepIdx);
            }
        }
    }
    return lines.join('\n') + '\n';
}
// --- Map data (JSON) ---
export async function getMapData(mapId) {
    const res = await fetch(`${DW_API_URL}${mapId}/data`, { headers: headers('application/json') });
    await checkStatus(res);
    const data = await res.json();
    if (!data.markers)
        throw new Error('Map data contains no marker');
    return data;
}
// --- Write data ---
export async function putChartDataEncoded(chartId, data) {
    const res = await fetch(`${DW_API_URL}${chartId}/data`, {
        method: 'PUT',
        body: data,
        headers: headers(),
    });
    await checkStatus(res);
}
export async function putData(mapId, data) {
    const res = await fetch(`${DW_API_URL}${mapId}/data`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify(data),
    });
    return await checkStatus(res, false);
}
// --- Duplicate ---
export async function duplicateChart(chartId) {
    const res = await fetch(`${DW_API_URL}${chartId}/copy`, {
        method: 'POST',
        headers: headers(),
    });
    if (res.status === 404)
        return false;
    await checkStatus(res);
    const data = await res.json();
    const newChartId = data.publicId;
    const chartType = data.type;
    if (typeof newChartId !== 'string')
        return false;
    const patchRes = await fetch(`${DW_API_URL}${newChartId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ folderId: config.dwFolder }),
    });
    await checkStatus(patchRes);
    return { new_chart_id: newChartId, chart_type: chartType };
}
// --- Chart texts ---
export async function getChartTexts(chartId) {
    const res = await fetch(`${DW_API_URL}${chartId}`, { headers: headers('application/json') });
    await checkStatus(res);
    const chartData = await res.json();
    const result = {};
    const title = (chartData.title || '').replace(' (Copier)', '');
    const intro = chartData.metadata?.describe?.intro || '';
    const notes = chartData.metadata?.annotate?.notes || '';
    const source = chartData.metadata?.describe?.['source-name'] || '';
    if (title)
        result.title = title;
    if (intro)
        result.intro = intro;
    if (notes)
        result['bottom-note'] = notes;
    if (source)
        result.source = source;
    return result;
}
// --- Patch metadata ---
export async function patchChartMeta(chartId, payload) {
    const res = await fetch(`${DW_API_URL}${chartId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
    });
    return await checkStatus(res, false);
}
export async function patchMapMeta(mapId, targetLang = 'FR') {
    const metaRes = await fetch(`${DW_API_URL}${mapId}`, { headers: headers('application/json') });
    const metadata = (await metaRes.json()).metadata;
    const legendFr = JSON.parse(readFileSync(resolve(__dirname, '../../../data/legend_fr.json'), 'utf-8'));
    const byline = metadata.describe.byline;
    metadata.describe.byline = byline + ', pra';
    metadata.annotate.notes = 'Actualisé le ' + getCurrentDate();
    metadata.visualize.key = legendFr;
    const res = await fetch(`${DW_API_URL}${mapId}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({
            title: 'La situation actuelle en Ukraine',
            language: targetLang === 'FR' ? 'fr-CH' : 'de-CH',
            metadata,
            folderId: config.dwFolderUkraineMaps,
        }),
    });
    return await checkStatus(res, false);
}
