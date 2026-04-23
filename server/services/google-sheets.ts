import { google } from 'googleapis';
import { config } from '../config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

function getSheets() {
  if (!config.googleServiceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(config.googleServiceAccountJson),
    scopes: SCOPES,
  });
  return google.sheets({ version: 'v4', auth });
}

export async function clearSpreadsheet(): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range: config.spreadsheetRangeNoHeader,
    requestBody: {},
  });
}

export async function updateSpreadsheet(values: any[][]): Promise<void> {
  await clearSpreadsheet();
  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [{
        range: config.spreadsheetRangeNoHeader,
        values: values.map(row => row.map(v => String(v))),
      }],
    },
  });

  if (!response.data.totalUpdatedCells || response.data.totalUpdatedCells === 0) {
    throw new Error('Spreadsheet batchUpdate: no cell was updated');
  }
}

export async function getSpreadsheetValues(
  spreadsheetId?: string,
  ranges?: string,
): Promise<Record<string, string>[]> {
  const sheets = getSheets();
  const id = spreadsheetId || config.spreadsheetId;
  const range = ranges || config.spreadsheetRangeWithHeader;

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: [range],
  });

  const values = response.data.valueRanges?.[0]?.values;
  if (!values || values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] || '';
    });
    return obj;
  });
}
