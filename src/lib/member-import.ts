import * as XLSX from 'xlsx';
import type { ChurchRecord, Gender } from '@/types/api';

export type ImportRowStatus =
  | 'ready'
  | 'duplicate_in_file'
  | 'invalid'
  | 'importing'
  | 'imported'
  | 'imported_verified'
  | 'duplicate_in_db'
  | 'failed';

export interface ParsedMemberRow {
  rowNumber: number; // 1-based Excel row number (header = 1, first data row = 2)
  firstName: string;
  middleName: string;
  surname: string;
  email: string;
  emailGenerated: boolean;
  phone: string;
  normalizedPhone: string;
  gender: Gender | '';
  dateOfBirth: string; // YYYY-MM-DD
  state: string;
  lga: string;
  residentialLocation: string;
  password: string;
  status: ImportRowStatus;
  selected: boolean;
  errors: string[];
  duplicateNote?: string;
  duplicateOfRow?: number;
  softDuplicateWarning?: string;
  resultMessage?: string;
  createdMemberId?: string;
}

export interface ParseOptions {
  church: ChurchRecord;
  defaultPassword: string;
  autoGenerateEmail: boolean;
}

// Normalize Nigerian phone numbers so 08031234567, 2348031234567, +234 803-123-4567 all match
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234') && cleaned.length >= 13) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+234${cleaned.slice(1)}`;
  if (/^[789][01]\d{8}$/.test(cleaned)) return `+234${cleaned}`;
  return cleaned;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES: Record<string, keyof RawFieldMap> = {
  firstname: 'firstName',
  fname: 'firstName',
  givenname: 'firstName',
  middlename: 'middleName',
  mname: 'middleName',
  othername: 'middleName',
  othernames: 'middleName',
  surname: 'surname',
  lastname: 'surname',
  lname: 'surname',
  familyname: 'surname',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  mobilenumber: 'phone',
  telephone: 'phone',
  tel: 'phone',
  gender: 'gender',
  sex: 'gender',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  birthdate: 'dateOfBirth',
  birthday: 'dateOfBirth',
  state: 'state',
  stateofresidence: 'state',
  lga: 'lga',
  localgovernment: 'lga',
  localgovernmentarea: 'lga',
  residentiallocation: 'residentialLocation',
  address: 'residentialLocation',
  residentialaddress: 'residentialLocation',
  location: 'residentialLocation',
  town: 'residentialLocation',
  password: 'password',
  temporarypassword: 'password',
};

interface RawFieldMap {
  firstName: string;
  middleName: string;
  surname: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  state: string;
  lga: string;
  residentialLocation: string;
  password: string;
}

function parseGender(raw: string): Gender | '' {
  const v = raw.trim().toLowerCase();
  if (v === 'male' || v === 'm' || v === 'man') return 'male';
  if (v === 'female' || v === 'f' || v === 'woman') return 'female';
  return '';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';

  // Excel serial date number
  if (typeof val === 'number' && val > 1000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    }
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }

  const str = String(val).trim();
  if (!str) return '';

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in Nigeria)
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    // If first > 12 it is definitely DD/MM/YYYY; default to DD/MM/YYYY
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const fallback = new Date(str);
  if (!Number.isNaN(fallback.getTime())) {
    return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  }

  return '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildOfflineEmail(firstName: string, surname: string, phone: string, rowNumber: number): string {
  const slug = `${firstName}.${surname}`
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
  const digits = phone.replace(/\D/g, '').slice(-6) || `r${rowNumber}`;
  return `${slug || 'member'}.${digits}@offline.nkst.org.ng`;
}

export async function parseMembersSpreadsheet(
  file: File,
  options: ParseOptions,
): Promise<ParsedMemberRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded file does not contain any worksheet.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  if (rawRows.length === 0) {
    throw new Error('No member rows found in the first worksheet.');
  }

  // Track first seen index for duplicate detection
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();
  const seenNameDob = new Map<string, number>();

  const parsed: ParsedMemberRow[] = [];

  rawRows.forEach((rawObj, idx) => {
    const rowNumber = idx + 2; // Excel row 1 is header
    const mapped: RawFieldMap = {
      firstName: '',
      middleName: '',
      surname: '',
      email: '',
      phone: '',
      gender: '',
      dateOfBirth: '',
      state: '',
      lga: '',
      residentialLocation: '',
      password: '',
    };

    let rawDobValue: unknown = '';

    for (const [colKey, colVal] of Object.entries(rawObj)) {
      const alias = HEADER_ALIASES[normalizeHeader(colKey)];
      if (!alias) continue;
      if (alias === 'dateOfBirth') {
        rawDobValue = colVal;
        mapped.dateOfBirth = parseExcelDate(colVal);
      } else {
        mapped[alias] = String(colVal ?? '').trim();
      }
    }

    // Skip completely empty rows
    const hasAnyContent =
      mapped.firstName ||
      mapped.surname ||
      mapped.phone ||
      mapped.email ||
      mapped.residentialLocation;
    if (!hasAnyContent) return;

    const normalizedPhone = normalizePhone(mapped.phone);
    const gender = parseGender(mapped.gender);
    const dateOfBirth = mapped.dateOfBirth || parseExcelDate(rawDobValue);
    const state = mapped.state || options.church.state || '';
    const lga = mapped.lga || options.church.lga || '';
    const residentialLocation =
      mapped.residentialLocation || options.church.town || options.church.address || '';
    const password = mapped.password || options.defaultPassword;

    let email = mapped.email.toLowerCase();
    let emailGenerated = false;
    if (!email && options.autoGenerateEmail && mapped.firstName && mapped.surname) {
      email = buildOfflineEmail(mapped.firstName, mapped.surname, normalizedPhone, rowNumber);
      emailGenerated = true;
    }

    const errors: string[] = [];
    if (!mapped.firstName) errors.push('Missing First Name');
    if (!mapped.surname) errors.push('Missing Surname');
    if (!normalizedPhone) errors.push('Missing Phone Number');
    else if (normalizedPhone.replace(/\D/g, '').length < 10) {
      errors.push('Phone number looks too short');
    }
    if (!email) errors.push('Missing Email (or enable auto-generate)');
    else if (!isValidEmail(email)) errors.push('Invalid Email format');
    if (!gender) errors.push('Gender must be male or female');
    if (!dateOfBirth) errors.push('Invalid or missing Date of Birth (YYYY-MM-DD)');
    if (!state) errors.push('Missing State');
    if (!lga) errors.push('Missing LGA');
    if (!residentialLocation) errors.push('Missing Residential Location');
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters');

    // Duplicate detection within the uploaded spreadsheet
    let duplicateNote: string | undefined;
    let duplicateOfRow: number | undefined;

    if (normalizedPhone && seenPhones.has(normalizedPhone)) {
      duplicateOfRow = seenPhones.get(normalizedPhone);
      duplicateNote = `Duplicate phone (${normalizedPhone}) of Row #${duplicateOfRow}`;
    } else if (email && seenEmails.has(email)) {
      duplicateOfRow = seenEmails.get(email);
      duplicateNote = `Duplicate email (${email}) of Row #${duplicateOfRow}`;
    }

    if (normalizedPhone && !seenPhones.has(normalizedPhone)) {
      seenPhones.set(normalizedPhone, rowNumber);
    }
    if (email && !seenEmails.has(email)) {
      seenEmails.set(email, rowNumber);
    }

    // Soft duplicate check: same full name + DOB (catches same person entered with different phone/email)
    let softDuplicateWarning: string | undefined;
    if (mapped.firstName && mapped.surname && dateOfBirth) {
      const personKey = `${mapped.firstName.toLowerCase()}|${mapped.surname.toLowerCase()}|${dateOfBirth}`;
      if (seenNameDob.has(personKey) && !duplicateNote) {
        softDuplicateWarning = `Same name & date of birth as Row #${seenNameDob.get(personKey)}`;
      } else if (!seenNameDob.has(personKey)) {
        seenNameDob.set(personKey, rowNumber);
      }
    }

    let status: ImportRowStatus = 'ready';
    if (errors.length > 0) {
      status = 'invalid';
    } else if (duplicateNote) {
      status = 'duplicate_in_file';
    }

    parsed.push({
      rowNumber,
      firstName: mapped.firstName,
      middleName: mapped.middleName,
      surname: mapped.surname,
      email,
      emailGenerated,
      phone: normalizedPhone || mapped.phone,
      normalizedPhone,
      gender,
      dateOfBirth,
      state,
      lga,
      residentialLocation,
      password,
      status,
      selected: status === 'ready',
      errors,
      duplicateNote,
      duplicateOfRow,
      softDuplicateWarning,
    });
  });

  return parsed;
}

export function downloadMemberImportTemplate(church?: ChurchRecord | null) {
  const sampleRows = [
    {
      'First Name': 'Terfa',
      'Middle Name': 'Aondowase',
      Surname: 'Tarka',
      Phone: '+2348031234567',
      Email: 'terfa.tarka@example.com',
      Gender: 'male',
      'Date of Birth': '1992-05-14',
      State: church?.state || 'Benue',
      LGA: church?.lga || 'Gboko',
      'Residential Location': church?.town ? `${church.town} Layout` : 'Mkar Road, Gboko',
    },
    {
      'First Name': 'Mimidoo',
      'Middle Name': '',
      Surname: 'Orkar',
      Phone: '08059876543',
      Email: '',
      Gender: 'female',
      'Date of Birth': '1988-11-03',
      State: church?.state || 'Benue',
      LGA: church?.lga || 'Gboko',
      'Residential Location': church?.town || 'Mkar',
    },
  ];

  const guideRows = [
    { Column: 'First Name', Required: 'Yes', Notes: 'Member first name' },
    { Column: 'Middle Name', Required: 'No', Notes: 'Optional middle / other name' },
    { Column: 'Surname', Required: 'Yes', Notes: 'Member family name / surname' },
    {
      Column: 'Phone',
      Required: 'Yes',
      Notes: 'Unique phone number (080... or +234... — normalized automatically)',
    },
    {
      Column: 'Email',
      Required: 'Recommended',
      Notes: 'Unique email. Leave blank if member has no email and enable "Auto-generate placeholder email" on upload.',
    },
    { Column: 'Gender', Required: 'Yes', Notes: 'male or female (M/F also accepted)' },
    { Column: 'Date of Birth', Required: 'Yes', Notes: 'YYYY-MM-DD or DD/MM/YYYY' },
    {
      Column: 'State',
      Required: 'Optional',
      Notes: 'Defaults to selected church State if left blank',
    },
    {
      Column: 'LGA',
      Required: 'Optional',
      Notes: 'Defaults to selected church LGA if left blank',
    },
    {
      Column: 'Residential Location',
      Required: 'Optional',
      Notes: 'Street / village / community. Defaults to church town if left blank.',
    },
  ];

  const wb = XLSX.utils.book_new();
  const wsMembers = XLSX.utils.json_to_sheet(sampleRows);
  wsMembers['!cols'] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMembers, 'Members');

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 64 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions');

  const fileSlug = church?.name
    ? church.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    : 'nkst-church';
  XLSX.writeFile(wb, `${fileSlug}-member-import-template.xlsx`);
}

export function exportImportResultsReport(rows: ParsedMemberRow[], churchName: string) {
  const reportRows = rows.map((r) => ({
    'Excel Row': r.rowNumber,
    'First Name': r.firstName,
    'Middle Name': r.middleName,
    Surname: r.surname,
    Phone: r.phone,
    Email: r.email,
    Gender: r.gender,
    'Date of Birth': r.dateOfBirth,
    Status: r.status,
    'Member ID': r.createdMemberId || '',
    Details:
      r.resultMessage ||
      r.duplicateNote ||
      (r.errors.length > 0 ? r.errors.join('; ') : r.softDuplicateWarning || ''),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Import Report');
  const slug = churchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  XLSX.writeFile(wb, `${slug}-import-report.xlsx`);
}
