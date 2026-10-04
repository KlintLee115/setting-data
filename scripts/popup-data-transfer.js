(() => {
const ENTRIES_KEY = 'entries';
const DATA_ROWS = 5000;
const MIN_SAMPLE = 5;
const REPLY_OUTCOMES = ['Replied', 'Qualified', 'Booked'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const OBJECTIONS = ['Partner', 'Had to go', 'Not interested', 'Just curious', 'Are u trying to sell me'];
const COLORS = {
  band: 'FF0F172A',
  ink: 'FF111827',
  muted: 'FF64748B',
  card: 'FFF1F5F9',
  line: 'FFCBD5E1',
  accent: 'FF2563EB',
  accentSoft: 'FFBFDBFE',
  white: 'FFFFFFFF'
};

function isDm(entry) {
  return entry.recordType === 'dm';
}

function activityValue(entry) {
  return isDm(entry)
    ? entry.dmDateTime || entry.timestamp || entry.createdAt
    : entry.callDateTime || entry.timestamp || entry.createdAt;
}

function callValue(entry) {
  return isDm(entry) ? '' : entry.callDateTime || entry.timestamp || entry.createdAt;
}

// Define exported columns for the raw data sheet
const ANALYSIS_COLUMNS = [
  ['Record type', (entry) => entry.recordType === 'call' ? 'Call' : entry.recordType === 'dm' ? 'DM' : 'Manual'],
  ['Lead name', (entry) => entry.name || entry.fullName],
  ['Email', (entry) => entry.email || ''],
  ['Phone', (entry) => entry.phone || ''],
  ['Intent', (entry) => entry.intent || ''],
  ['Outcome', (entry) => entry.status || ''],
  ['Call date/time', (entry) => toExcelDate(callValue(entry))],
  ['Call duration (seconds)', (entry) => durationToSeconds(entry.callDuration)],
  ['Picked up?', (entry) => entry.phonePickedUp === 'Yes' || entry.phonePickedUp === true ? 'Yes' : 'No'],
  ['Talk time (seconds)', (entry) => durationToSeconds(entry.talkTime)],
  ['Client type', (entry) => entry.clientType || ''],
  ['Objection: Partner', (entry) => hasObjection(entry.objections, 'Partner')],
  ['Objection: Had to go', (entry) => hasObjection(entry.objections, 'Had to go')],
  ['Objection: Not interested', (entry) => hasObjection(entry.objections, 'Not interested')],
  ['Objection: Just curious', (entry) => hasObjection(entry.objections, 'Just curious')],
  ['Objection: Are u trying to sell me', (entry) => hasObjection(entry.objections, 'Are u trying to sell me')],
  ['Pitch outcome', (entry) => entry.pitched || ''],
  ['Closer', (entry) => entry.closer || ''],
  ['Appointment date/time', (entry) => toExcelDate(entry.appointmentDate)],
  ['Showed?', (entry) => entry.showed ? 'Yes' : 'No'],
  ['Revenue', (entry) => typeof entry.revenue === 'number' ? entry.revenue : 0],
  ['Last text message', (entry) => entry.lastTextMessage || ''],
  ['Notes', (entry) => entry.notes || ''],
  ['Source URL', (entry) => entry.sourceUrl || ''],
  ['DM date/time', (entry) => toExcelDate(entry.dmDateTime)],
  ['DM channel', (entry) => entry.dmChannel || ''],
  ['DM outcome', (entry) => entry.dmOutcome || ''],
  ['DM message', (entry) => entry.dmMessage || ''],
  ['DM response', (entry) => entry.dmResponse || ''],
  ['Response date/time', (entry) => toExcelDate(entry.responseDateTime)],
  ['Lead replied?', (entry) => !isDm(entry) ? '' : REPLY_OUTCOMES.includes(entry.dmOutcome || entry.status) || entry.dmResponse ? 'Yes' : 'No'],
  ['Activity date', (entry) => toExcelDay(activityValue(entry))],
  ['Week starting (Mon)', (entry) => toWeekStart(activityValue(entry))],
  ['Call hour', (entry) => datePart(callValue(entry), (date) => date.getUTCHours())],
  ['Call weekday', (entry) => datePart(callValue(entry), (date) => WEEKDAYS[date.getUTCDay()])]
];

const DATE_TIME_COLUMNS = ['Call date/time', 'Appointment date/time', 'DM date/time', 'Response date/time'];
const DATE_COLUMNS = ['Activity date', 'Week starting (Mon)'];

// Helper to convert column index (0-based) to Excel Column Letter (A, B, C... AA)
function colToLetter(colIndex) {
  let temp = '';
  let letter = '';
  while (colIndex >= 0) {
    temp = (colIndex % 26);
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp) / 26) - 1;
  }
  return letter;
}

function getColumnLetter(headerName) {
  const index = ANALYSIS_COLUMNS.findIndex(([name]) => name === headerName);
  return index !== -1 ? colToLetter(index) : 'A';
}

// Excel stores dates without a timezone, so shift to local wall-clock time; the UTC fields then equal local time.
function toExcelDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000);
}

function toExcelDay(value) {
  const date = toExcelDate(value);
  return date instanceof Date
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    : '';
}

function toWeekStart(value) {
  const day = toExcelDay(value);
  return day instanceof Date
    ? new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000)
    : '';
}

function datePart(value, getPart) {
  const date = toExcelDate(value);
  return date instanceof Date ? getPart(date) : '';
}

function durationToSeconds(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(text)) return '';
  const parts = text.split(':').map(Number);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return '';
}

function hasObjection(value, objection) {
  return String(value || '').split(',').map((item) => item.trim()).includes(objection);
}

function rng(header) {
  const column = getColumnLetter(header);
  return `Entries!$${column}$2:$${column}$${DATA_ROWS + 1}`;
}

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function styleRange(worksheet, address, style) {
  const [start, end] = address.split(':');
  const first = worksheet.getCell(start);
  const last = worksheet.getCell(end || start);
  for (let row = first.row; row <= last.row; row += 1) {
    for (let column = first.col; column <= last.col; column += 1) {
      Object.assign(worksheet.getCell(row, column), style);
    }
  }
}

function put(worksheet, address, value, style = {}) {
  const cell = worksheet.getCell(address);
  cell.value = typeof value === 'string' && value.startsWith('=') ? { formula: value.slice(1) } : value;
  Object.assign(cell, style);
  return cell;
}

function merged(worksheet, address, value, style = {}) {
  worksheet.mergeCells(address);
  return put(worksheet, address.split(':')[0], value, style);
}

function sectionTitle(worksheet, row, title, subtitle) {
  styleRange(worksheet, `B${row}:M${row}`, {
    border: { bottom: { style: 'medium', color: { argb: COLORS.accent } } }
  });
  put(worksheet, `B${row}`, title, { font: { name: 'Calibri', size: 13, bold: true, color: { argb: COLORS.ink } } });
  if (subtitle) {
    put(worksheet, `F${row}`, subtitle, {
      font: { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.muted } },
      alignment: { horizontal: 'left' }
    });
  }
}

function headerRow(worksheet, row, cells) {
  cells.forEach(([address, label, align]) => {
    const target = address.includes(':') ? (worksheet.mergeCells(`${address.split(':')[0]}${row}:${address.split(':')[1]}${row}`), address.split(':')[0]) : address;
    put(worksheet, `${target}${row}`, label, {
      font: { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.muted } },
      alignment: { horizontal: align || 'left', vertical: 'middle' }
    });
  });
  styleRange(worksheet, `B${row}:M${row}`, { fill: fill(COLORS.card) });
}

const BODY_FONT = { name: 'Calibri', size: 10, color: { argb: COLORS.ink } };
const BAR_FONT = { name: 'Calibri', size: 10, color: { argb: COLORS.accent } };

function bar(ratioRef, scale) {
  return `=IF(${ratioRef}="","",IF(ISNUMBER(${ratioRef}),REPT("█",ROUND(${ratioRef}*${scale},0)),""))`;
}

function body(worksheet, row, { label, labelRange, values }) {
  merged(worksheet, `${labelRange || `B${row}:C${row}`}`.replace(/\d+/g, String(row)), label, { font: BODY_FONT });
  values.forEach(([address, value, numFmt, align]) => {
    put(worksheet, `${address}${row}`, value, {
      font: BODY_FONT,
      alignment: { horizontal: align || 'right' },
      ...(numFmt ? { numFmt } : {})
    });
  });
}

function rowBar(worksheet, row, range, formula) {
  const [first, last] = range.split(':');
  worksheet.mergeCells(`${first}${row}:${last}${row}`);
  put(worksheet, `${first}${row}`, formula, { font: BAR_FONT, alignment: { horizontal: 'left' } });
}

function rowDivider(worksheet, row) {
  styleRange(worksheet, `B${row}:M${row}`, {
    border: { bottom: { style: 'hair', color: { argb: COLORS.line } } }
  });
}

function addColorScale(worksheet, ref) {
  worksheet.addConditionalFormatting({
    ref,
    rules: [{
      type: 'colorScale',
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: [{ argb: COLORS.white }, { argb: COLORS.accentSoft }]
    }]
  });
}

function buildDashboardWorksheet(workbook) {
  const worksheet = workbook.addWorksheet('Dashboard', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.accent } }
  });
  worksheet.getColumn(1).width = 2;
  for (let column = 2; column <= 13; column += 1) worksheet.getColumn(column).width = 12.5;
  worksheet.getColumn(14).width = 2;

  const type = rng('Record type');
  const picked = rng('Picked up?');
  const pitch = rng('Pitch outcome');
  const week = rng('Week starting (Mon)');
  const hour = rng('Call hour');
  const weekday = rng('Call weekday');
  const replied = rng('Lead replied?');
  const dmOutcome = rng('DM outcome');
  const client = rng('Client type');
  const calls = `${type},"<>DM",${type},"<>"`;
  const pickups = `${type},"<>DM",${picked},"Yes"`;

  // Title band
  styleRange(worksheet, 'B1:M2', { fill: fill(COLORS.band) });
  worksheet.getRow(1).height = 30;
  merged(worksheet, 'B1:M1', 'Outreach performance dashboard', {
    font: { name: 'Calibri', size: 20, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: 'middle', indent: 1 }
  });
  merged(worksheet, 'B2:M2', {
    formula: `"Updated "&TEXT(TODAY(),"mmm d, yyyy")&"  |  Live formulas over the Entries sheet. Add or edit rows there and everything here recalculates."`
  }, {
    font: { name: 'Calibri', size: 9, color: { argb: 'FFCBD5E1' } },
    alignment: { vertical: 'middle', indent: 1 }
  });

  // KPI cards
  const cards = [
    ['B', 'C', 'CALLS LOGGED', '=D11', '#,##0', '=D12&" picked up"'],
    ['D', 'E', 'PICKUP RATE', '=IF(E12="","–",E12)', '0.0%', '=D12&" of "&D11&" calls"'],
    ['F', 'G', 'APPOINTMENTS BOOKED', '=D14', '#,##0', '=IF(D12=0,"–",TEXT(D14/D12,"0.0%"))&" of pickups"'],
    ['H', 'I', 'PITCH TO BOOKING', '=IF(E14="","–",E14)', '0.0%', '=D14&" of "&D13&" pitched"'],
    ['J', 'K', 'DMS SENT', '=D19', '#,##0', `="This week: "&COUNTIFS(${type},"DM",${week},TODAY()-WEEKDAY(TODAY(),2)+1)`],
    ['L', 'M', 'DM REPLY RATE', '=IF(E20="","–",E20)', '0.0%', '=D20&" of "&D19&" replied"']
  ];
  worksheet.getRow(5).height = 34;
  cards.forEach(([from, to, label, value, numFmt, sub]) => {
    styleRange(worksheet, `${from}4:${to}6`, {
      fill: fill(COLORS.card),
      border: { left: { style: 'thick', color: { argb: COLORS.white } }, right: { style: 'thick', color: { argb: COLORS.white } } }
    });
    merged(worksheet, `${from}4:${to}4`, label, {
      font: { name: 'Calibri', size: 8, bold: true, color: { argb: COLORS.muted } },
      alignment: { horizontal: 'center', vertical: 'bottom' }
    });
    merged(worksheet, `${from}5:${to}5`, value, {
      font: { name: 'Calibri', size: 24, bold: true, color: { argb: COLORS.ink } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt
    });
    merged(worksheet, `${from}6:${to}6`, sub, {
      font: { name: 'Calibri', size: 9, color: { argb: COLORS.muted } },
      alignment: { horizontal: 'center', vertical: 'top' }
    });
  });

  // Call funnel
  sectionTitle(worksheet, 9, 'Call funnel', 'Each stage shows its share of the previous stage and of all attempts');
  headerRow(worksheet, 10, [
    ['B:C', 'Stage'], ['D', 'Count', 'right'], ['E', 'vs previous', 'right'], ['F', 'vs attempts', 'right'], ['G:M', '']
  ]);
  const funnel = [
    [11, 'Logged call attempts', `=COUNTIFS(${calls})`, null],
    [12, 'Picked up', `=COUNTIFS(${pickups})`, '=IF(D11=0,"",D12/D11)'],
    [13, 'Pitched', `=COUNTIFS(${calls},${pitch},"Low Ticket")+COUNTIFS(${calls},${pitch},"High Ticket")`, '=IF(D12=0,"",D13/D12)'],
    [14, 'Appointments booked', `=COUNTIFS(${calls},${pitch},"High Ticket")`, '=IF(D13=0,"",D14/D13)'],
    [15, 'Low-ticket self-closes', `=COUNTIFS(${calls},${pitch},"Low Ticket")`, '=IF(D13=0,"",D15/D13)']
  ];
  funnel.forEach(([row, label, count, previous]) => {
    body(worksheet, row, {
      label,
      values: [
        ['D', count, '#,##0'],
        ['E', previous || '', '0.0%'],
        ['F', `=IF($D$11=0,"",D${row}/$D$11)`, '0.0%']
      ]
    });
    rowBar(worksheet, row, 'G:M', bar(`F${row}`, 40));
    rowDivider(worksheet, row);
  });

  // DM funnel
  sectionTitle(worksheet, 17, 'DM funnel', 'Replied counts a recorded lead response or a Replied, Qualified or Booked outcome');
  headerRow(worksheet, 18, [
    ['B:C', 'Stage'], ['D', 'Count', 'right'], ['E', 'vs previous', 'right'], ['F', 'vs sent', 'right'], ['G:M', '']
  ]);
  const dmFunnel = [
    [19, 'DMs sent', `=COUNTIFS(${type},"DM")`, null],
    [20, 'Lead replied', `=COUNTIFS(${type},"DM",${replied},"Yes")`, '=IF(D19=0,"",D20/D19)'],
    [21, 'Qualified', `=COUNTIFS(${type},"DM",${dmOutcome},"Qualified")+COUNTIFS(${type},"DM",${dmOutcome},"Booked")`, '=IF(D20=0,"",D21/D20)'],
    [22, 'Booked', `=COUNTIFS(${type},"DM",${dmOutcome},"Booked")`, '=IF(D21=0,"",D22/D21)']
  ];
  dmFunnel.forEach(([row, label, count, previous]) => {
    body(worksheet, row, {
      label,
      values: [
        ['D', count, '#,##0'],
        ['E', previous || '', '0.0%'],
        ['F', `=IF($D$19=0,"",D${row}/$D$19)`, '0.0%']
      ]
    });
    rowBar(worksheet, row, 'G:M', bar(`F${row}`, 40));
    rowDivider(worksheet, row);
  });

  // Weekly trend
  sectionTitle(worksheet, 24, 'Weekly trend', 'Last 12 weeks, weeks start Monday');
  headerRow(worksheet, 25, [
    ['B', 'Week of'], ['C', 'Calls', 'right'], ['D', 'Pickups', 'right'], ['E', 'Pickup rate', 'right'],
    ['F', 'Appts', 'right'], ['G', 'DMs', 'right'], ['H', 'Replies', 'right'], ['I', 'Reply rate', 'right'], ['J:M', 'Call volume']
  ]);
  for (let index = 0; index < 12; index += 1) {
    const row = 26 + index;
    put(worksheet, `B${row}`, `=TODAY()-WEEKDAY(TODAY(),2)+1-7*${11 - index}`, { font: BODY_FONT, numFmt: 'mmm d', alignment: { horizontal: 'left' } });
    [
      ['C', `=COUNTIFS(${calls},${week},$B${row})`, '#,##0'],
      ['D', `=COUNTIFS(${pickups},${week},$B${row})`, '#,##0'],
      ['E', `=IF(C${row}=0,"",D${row}/C${row})`, '0.0%'],
      ['F', `=COUNTIFS(${calls},${pitch},"High Ticket",${week},$B${row})`, '#,##0'],
      ['G', `=COUNTIFS(${type},"DM",${week},$B${row})`, '#,##0'],
      ['H', `=COUNTIFS(${type},"DM",${replied},"Yes",${week},$B${row})`, '#,##0'],
      ['I', `=IF(G${row}=0,"",H${row}/G${row})`, '0.0%']
    ].forEach(([column, formula, numFmt]) => {
      put(worksheet, `${column}${row}`, formula, { font: BODY_FONT, numFmt, alignment: { horizontal: 'right' } });
    });
    rowBar(worksheet, row, 'J:M', `=IF(MAX($C$26:$C$37)=0,"",REPT("█",ROUND(C${row}/MAX($C$26:$C$37)*20,0)))`);
    rowDivider(worksheet, row);
  }
  addColorScale(worksheet, 'E26:E37');
  addColorScale(worksheet, 'I26:I37');

  // Pickup rate by time of day
  sectionTitle(worksheet, 39, 'Pickup rate by time of day', `Local call time. Rates need ${MIN_SAMPLE}+ attempts`);
  headerRow(worksheet, 40, [
    ['B', 'Time block'], ['C', 'Attempts', 'right'], ['D', 'Pickups', 'right'], ['E', 'Pickup rate', 'right'], ['F:M', '']
  ]);
  const blocks = [
    ['Before 9am', 0, 9], ['9am-12pm', 9, 12], ['12pm-3pm', 12, 15],
    ['3pm-6pm', 15, 18], ['6pm-9pm', 18, 21], ['After 9pm', 21, 24]
  ];
  blocks.forEach(([label, low, high], index) => {
    const row = 41 + index;
    const hours = `${hour},">=${low}",${hour},"<${high}"`;
    put(worksheet, `B${row}`, label, { font: BODY_FONT });
    put(worksheet, `C${row}`, `=COUNTIFS(${calls},${hours})`, { font: BODY_FONT, numFmt: '#,##0', alignment: { horizontal: 'right' } });
    put(worksheet, `D${row}`, `=COUNTIFS(${pickups},${hours})`, { font: BODY_FONT, numFmt: '#,##0', alignment: { horizontal: 'right' } });
    put(worksheet, `E${row}`, `=IF(C${row}=0,"",IF(C${row}<${MIN_SAMPLE},"n<${MIN_SAMPLE}",D${row}/C${row}))`, { font: BODY_FONT, numFmt: '0.0%', alignment: { horizontal: 'right' } });
    rowBar(worksheet, row, 'F:M', bar(`E${row}`, 40));
    rowDivider(worksheet, row);
  });
  addColorScale(worksheet, 'E41:E46');

  // Pickup rate by weekday
  sectionTitle(worksheet, 48, 'Pickup rate by weekday', `Rates need ${MIN_SAMPLE}+ attempts`);
  headerRow(worksheet, 49, [
    ['B', 'Weekday'], ['C', 'Attempts', 'right'], ['D', 'Pickups', 'right'], ['E', 'Pickup rate', 'right'], ['F:M', '']
  ]);
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day, index) => {
    const row = 50 + index;
    put(worksheet, `B${row}`, day, { font: BODY_FONT });
    put(worksheet, `C${row}`, `=COUNTIFS(${calls},${weekday},$B${row})`, { font: BODY_FONT, numFmt: '#,##0', alignment: { horizontal: 'right' } });
    put(worksheet, `D${row}`, `=COUNTIFS(${pickups},${weekday},$B${row})`, { font: BODY_FONT, numFmt: '#,##0', alignment: { horizontal: 'right' } });
    put(worksheet, `E${row}`, `=IF(C${row}=0,"",IF(C${row}<${MIN_SAMPLE},"n<${MIN_SAMPLE}",D${row}/C${row}))`, { font: BODY_FONT, numFmt: '0.0%', alignment: { horizontal: 'right' } });
    rowBar(worksheet, row, 'F:M', bar(`E${row}`, 40));
    rowDivider(worksheet, row);
  });
  addColorScale(worksheet, 'E50:E56');

  // Objections
  sectionTitle(worksheet, 58, 'Objections on picked-up calls', 'A call can carry more than one objection');
  headerRow(worksheet, 59, [['B:C', 'Objection'], ['D', 'Calls', 'right'], ['E', '% of pickups', 'right'], ['F:M', '']]);
  OBJECTIONS.forEach((objection, index) => {
    const row = 60 + index;
    body(worksheet, row, {
      label: objection,
      values: [
        ['D', `=COUNTIFS(${pickups},${rng(`Objection: ${objection}`)},TRUE)`, '#,##0'],
        ['E', `=IF($D$12=0,"",D${row}/$D$12)`, '0.0%']
      ]
    });
    rowBar(worksheet, row, 'F:M', bar(`E${row}`, 40));
    rowDivider(worksheet, row);
  });

  // Client type
  sectionTitle(worksheet, 66, 'Booking by client type', 'Picked-up calls only; a lead can be both');
  headerRow(worksheet, 67, [['B:C', 'Client type'], ['D', 'Pickups', 'right'], ['E', 'Appts', 'right'], ['F', 'Booking rate', 'right'], ['G:M', '']]);
  ['9-5', 'Business Owner'].forEach((label, index) => {
    const row = 68 + index;
    const match = `${client},"*${label}*"`;
    body(worksheet, row, {
      label,
      values: [
        ['D', `=COUNTIFS(${pickups},${match})`, '#,##0'],
        ['E', `=COUNTIFS(${calls},${match},${pitch},"High Ticket")`, '#,##0'],
        ['F', `=IF(D${row}=0,"",E${row}/D${row})`, '0.0%']
      ]
    });
    rowBar(worksheet, row, 'G:M', bar(`F${row}`, 40));
    rowDivider(worksheet, row);
  });

  // Quick reads
  sectionTitle(worksheet, 71, 'Quick reads');
  const reads = [
    '="Top objection: "&IF(MAX($D$60:$D$64)=0,"none logged",INDEX($B$60:$B$64,MATCH(MAX($D$60:$D$64),$D$60:$D$64,0))&" ("&MAX($D$60:$D$64)&" calls)")',
    `="Best time block to call: "&IF(COUNT($E$41:$E$46)=0,"not enough data yet",INDEX($B$41:$B$46,MATCH(MAX($E$41:$E$46),$E$41:$E$46,0))&" ("&TEXT(MAX($E$41:$E$46),"0%")&" pickup)")`,
    `="Best weekday to call: "&IF(COUNT($E$50:$E$56)=0,"not enough data yet",INDEX($B$50:$B$56,MATCH(MAX($E$50:$E$56),$E$50:$E$56,0))&" ("&TEXT(MAX($E$50:$E$56),"0%")&" pickup)")`
  ];
  reads.forEach((formula, index) => {
    const row = 72 + index;
    merged(worksheet, `B${row}:M${row}`, formula, { font: BODY_FONT });
  });

  worksheet.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return worksheet;
}

function buildEntriesWorksheet(workbook, entries) {
  const worksheet = workbook.addWorksheet('Entries', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    properties: { tabColor: { argb: COLORS.muted } }
  });
  worksheet.addRow(ANALYSIS_COLUMNS.map(([header]) => header));
  entries.forEach((entry) => {
    worksheet.addRow(ANALYSIS_COLUMNS.map(([, getValue]) => {
      const value = getValue(entry) ?? '';
      return value === '' ? null : value;
    }));
  });

  const header = worksheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = fill(COLORS.band);
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  ANALYSIS_COLUMNS.forEach(([name], index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = Math.min(Math.max(name.length + 4, 14), 36);
    if (DATE_TIME_COLUMNS.includes(name)) column.numFmt = 'yyyy-mm-dd hh:mm';
    if (DATE_COLUMNS.includes(name)) column.numFmt = 'yyyy-mm-dd';
    if (name === 'Revenue') column.numFmt = '$#,##0';
  });
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(entries.length + 1, 2), column: ANALYSIS_COLUMNS.length }
  };
  return worksheet;
}

const DEFINITIONS = [
  ['Logged call attempts', 'Every Call or Manual record that is not a DM.'],
  ['Picked up', 'Call attempts where Picked up? is Yes. Pickup rate = picked up / attempts.'],
  ['Pitched', 'Picked-up calls whose Pitch outcome is Low Ticket or High Ticket.'],
  ['Appointments booked', 'Calls whose Pitch outcome is High Ticket (high ticket booking).'],
  ['Pitch to booking', 'Appointments booked / pitched.'],
  ['Low-ticket self-closes', 'Calls whose Pitch outcome is Low Ticket.'],
  ['DMs sent', 'Every DM record.'],
  ['Lead replied', 'DMs with a recorded lead response, or an outcome of Replied, Qualified or Booked.'],
  ['DM reply rate', 'Lead replied / DMs sent.'],
  ['Time of day / weekday', 'Based on the Call date/time in your local time at export. Rates show n<5 until a bucket has 5 attempts.'],
  ['Weekly trend', 'Uses Week starting (Mon), derived from the call or DM date. Shows the 12 weeks ending this week.'],
  ['Objections', 'Counted on picked-up calls only; one call can have several.'],
  ['Client type', 'Checkboxes on the call form: 9-5 and Business Owner. A lead can be both.']
];

function buildDefinitionsWorksheet(workbook) {
  const worksheet = workbook.addWorksheet('Definitions', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.line } }
  });
  worksheet.getColumn(1).width = 26;
  worksheet.getColumn(2).width = 100;
  worksheet.addRow(['Metric', 'How it is calculated']).eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = fill(COLORS.band);
  });
  DEFINITIONS.forEach((definition) => {
    worksheet.addRow(definition).eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: COLORS.line } } };
    });
  });
  return worksheet;
}

function buildWorkbook(entries) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GHL Call Log';
  workbook.calcProperties = { fullCalcOnLoad: true };
  buildDashboardWorksheet(workbook);
  buildEntriesWorksheet(workbook, entries);
  buildDefinitionsWorksheet(workbook);
  return workbook;
}

async function loadCombinedEntries() {
  const stored = await chrome.storage.local.get({ entries: [], callLogs: [], manualEntries: [] });
  return Array.isArray(stored[ENTRIES_KEY]) && stored[ENTRIES_KEY].length
    ? stored[ENTRIES_KEY]
    : [
      ...stored.callLogs.map((entry) => ({ ...entry, recordType: 'call' })),
      ...stored.manualEntries.map((entry) => ({ ...entry, recordType: 'entry' }))
    ];
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportXlsx() {
  const entries = await loadCombinedEntries();
  const workbook = buildWorkbook(entries);
  const content = await workbook.xlsx.writeBuffer();
  downloadFile(content, `call-log-export-${new Date().toISOString().slice(0, 10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function setupPopupDataTransfer() {
  const exportBtn = document.getElementById('export-xlsx');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportXlsx);
  }
}

globalThis.popupDataTransfer = { buildWorkbook, durationToSeconds };
globalThis.setupPopupDataTransfer = setupPopupDataTransfer;
})();
