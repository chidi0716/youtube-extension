import { describe, expect, it } from 'vitest';
import {
  convertCaption,
  cuesToSrt,
  cuesToTxt,
  cuesToVtt,
  decodeEntities,
  formatTimestamp,
  parseTimedTextXml,
  parseTimestamp,
  parseVtt,
  plainText,
} from './captions';

// 上傳的字幕（一般 VTT，含標頭、NOTE、cue 識別名稱、位置設定）
const UPLOADED_VTT = `WEBVTT
Kind: captions
Language: en

NOTE this is a comment

1
00:00:01.000 --> 00:00:04.500 align:start position:0%
Hello &amp; welcome
to the <i>show</i>

00:01:02.250 --> 00:01:05.000
Second line

01:00:00.000 --> 01:00:01.500
An hour in
`;

// 自動產生的字幕（YouTube 的捲動格式：每個 cue 重複上一句，並有逐字時間標籤）
const AUTO_VTT = [
  'WEBVTT',
  'Kind: captions',
  'Language: en',
  '',
  '00:00:00.320 --> 00:00:02.750 align:start position:0%',
  ' ', // YouTube 在這裡放一個只有空白的行（不是空行）
  'so<00:00:00.640><c> today</c><00:00:00.960><c> we</c>',
  '',
  '00:00:02.750 --> 00:00:02.760 align:start position:0%',
  'so today we',
  ' ',
  '',
  '00:00:02.760 --> 00:00:05.110 align:start position:0%',
  'so today we',
  'are<00:00:03.100><c> talking</c>',
  '',
  '00:00:05.110 --> 00:00:05.120 align:start position:0%',
  'are talking',
  ' ',
  '',
].join('\n');

describe('時間碼', () => {
  it('解析 HH:MM:SS.mmm 與 MM:SS.mmm', () => {
    expect(parseTimestamp('00:01:02.250')).toBe(62_250);
    expect(parseTimestamp('01:02.5')).toBe(62_500);
    expect(parseTimestamp('1:00:00,001')).toBe(3_600_001);
    expect(parseTimestamp('nope')).toBeNull();
  });

  it('格式化為 VTT 與 SRT', () => {
    expect(formatTimestamp(62_250, '.')).toBe('00:01:02.250');
    expect(formatTimestamp(3_723_004, ',')).toBe('01:02:03,004');
    expect(formatTimestamp(-5, ',')).toBe('00:00:00,000');
  });
});

describe('文字整理', () => {
  it('解碼實體（含編碼兩次的情況由呼叫端處理）', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#39;d&#39; &#x2665; &quot;')).toBe('a & b <c> \'d\' ♥ "');
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });

  it('去掉行內標籤與空行', () => {
    expect(plainText('so<00:00:00.640><c> today</c>\n \n<i>we</i>')).toBe('so today\nwe');
  });
});

describe('parseVtt', () => {
  it('略過標頭、NOTE 與識別名稱，讀出時間與文字', () => {
    const cues = parseVtt(UPLOADED_VTT);
    expect(cues.map((c) => [c.start, c.end])).toEqual([
      [1000, 4500],
      [62_250, 65_000],
      [3_600_000, 3_601_500],
    ]);
    expect(cues[0]!.text).toBe('Hello &amp; welcome\nto the <i>show</i>');
  });

  it('接受 CRLF 與 BOM', () => {
    expect(parseVtt('\uFEFFWEBVTT\r\n\r\n00:00.000 --> 00:01.000\r\nHi\r\n')).toEqual([{ start: 0, end: 1000, text: 'Hi' }]);
  });
});

describe('VTT → SRT（002 FR-41）', () => {
  it('時間碼正確、去掉標籤與實體、重新編號', () => {
    expect(convertCaption(UPLOADED_VTT, 'srt')).toBe(
      '1\n00:00:01,000 --> 00:00:04,500\nHello & welcome\nto the show\n\n' +
        '2\n00:01:02,250 --> 00:01:05,000\nSecond line\n\n' +
        '3\n01:00:00,000 --> 01:00:01,500\nAn hour in\n',
    );
  });

  it('自動字幕：沒有文字的 cue 略過', () => {
    const srt = convertCaption(AUTO_VTT, 'srt')!;
    expect(srt.startsWith('1\n00:00:00,320 --> 00:00:02,750\nso today we\n')).toBe(true);
    expect(srt).not.toMatch(/<|&/);
  });
});

describe('VTT → TXT（002 FR-41）', () => {
  it('只有文字，沒有時間碼', () => {
    const txt = convertCaption(UPLOADED_VTT, 'txt')!;
    expect(txt).toBe('Hello & welcome\nto the show\nSecond line\nAn hour in\n');
    expect(txt).not.toMatch(/-->|\d\d:\d\d/);
  });

  it('自動字幕捲動造成的重複行只保留一次', () => {
    expect(convertCaption(AUTO_VTT, 'txt')).toBe('so today we\nare talking\n');
  });
});

describe('VTT → VTT', () => {
  it('原樣保留，只統一換行', () => {
    expect(convertCaption('WEBVTT\r\n\r\n00:00.000 --> 00:01.000\r\n<c>Hi</c>\r\n', 'vtt')).toBe('WEBVTT\n\n00:00.000 --> 00:01.000\n<c>Hi</c>\n');
  });
});

describe('YouTube XML → VTT／SRT（plan 3.8）', () => {
  const FORMAT1 = `<?xml version="1.0" encoding="utf-8" ?><transcript><text start="0.5" dur="2.25">It&amp;#39;s &lt;fine&gt;</text><text start="3" dur="1">Next\nline</text><text start="5">No duration</text><text start="9.5" dur="1">Last</text></transcript>`;
  const FORMAT3 = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body><p t="1200" d="2300"><s>Word</s><s t="400"> by</s><s t="800"> word</s></p><p t="4000" d="1000">A &amp; B</p><p t="6000" d="500"></p></body></timedtext>`;

  it('解析 <transcript><text>（秒，實體編碼兩次）', () => {
    expect(parseTimedTextXml(FORMAT1)).toEqual([
      { start: 500, end: 2750, text: "It's &lt;fine&gt;" },
      { start: 3000, end: 4000, text: 'Next\nline' },
      { start: 5000, end: 9500, text: 'No duration' },
      { start: 9500, end: 10_500, text: 'Last' },
    ]);
  });

  it('解析 format 3 的 <p t d>（毫秒、逐字標籤），空白段落略過', () => {
    expect(parseTimedTextXml(FORMAT3)).toEqual([
      { start: 1200, end: 3500, text: 'Word by word' },
      { start: 4000, end: 5000, text: 'A &amp; B' },
    ]);
  });

  it('轉成 VTT 時跳脫特殊字元', () => {
    expect(convertCaption(FORMAT1, 'vtt')).toBe(
      'WEBVTT\n\n00:00:00.500 --> 00:00:02.750\nIt\'s &lt;fine&gt;\n\n00:00:03.000 --> 00:00:04.000\nNext\nline\n\n' +
        '00:00:05.000 --> 00:00:09.500\nNo duration\n\n00:00:09.500 --> 00:00:10.500\nLast\n',
    );
  });

  it('轉成 SRT 與 TXT', () => {
    expect(convertCaption(FORMAT3, 'srt')).toBe('1\n00:00:01,200 --> 00:00:03,500\nWord by word\n\n2\n00:00:04,000 --> 00:00:05,000\nA & B\n');
    expect(convertCaption(FORMAT3, 'txt')).toBe('Word by word\nA & B\n');
  });
});

describe('無法轉換的內容', () => {
  it('空白、HTML 錯誤頁、沒有文字的字幕回傳 null', () => {
    expect(convertCaption('', 'srt')).toBeNull();
    expect(convertCaption('<html><body>Sorry</body></html>', 'srt')).toBeNull();
    expect(convertCaption('WEBVTT\n\n', 'txt')).toBeNull();
    expect(convertCaption('<transcript></transcript>', 'vtt')).toBeNull();
  });
});

describe('輸出函式', () => {
  const cues = [
    { start: 0, end: 1000, text: 'A' },
    { start: 1000, end: 2000, text: ' ' },
    { start: 2000, end: 3000, text: 'A' },
  ];
  it('cuesToSrt、cuesToVtt 略過空的 cue；cuesToTxt 合併相鄰的重複行', () => {
    expect(cuesToSrt(cues)).toBe('1\n00:00:00,000 --> 00:00:01,000\nA\n\n2\n00:00:02,000 --> 00:00:03,000\nA\n');
    expect(cuesToVtt(cues).split('-->')).toHaveLength(3);
    expect(cuesToTxt(cues)).toBe('A\n');
  });
});
