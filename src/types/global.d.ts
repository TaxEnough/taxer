declare module 'papaparse' {
  export interface ParseConfig {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    dynamicTyping?: boolean;
    preview?: number;
    encoding?: string;
    worker?: boolean;
    comments?: boolean | string;
    download?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    fastMode?: boolean;
    withCredentials?: boolean;
    delimitersToGuess?: string[];
    chunk?: (results: ParseResult<any>, parser: Parser) => void;
    complete?: (results: ParseResult<any>, file: File) => void;
    error?: (error: Error, file: File) => void;
    transform?: (value: string, field: string | number) => any;
    transformHeader?: (header: string, index: number) => string;
    step?: (results: ParseStepResult<any>, parser: Parser) => void;
    before?: (file: File, inputElem: Element) => void;
    beforeFirstChunk?: (chunk: string) => string | void;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseStepResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    fields: string[];
    truncated: boolean;
    cursor: number;
  }

  export interface UnparseConfig {
    quotes?: boolean | boolean[] | ((value: any) => boolean);
    quoteChar?: string;
    escapeChar?: string;
    delimiter?: string;
    header?: boolean;
    newline?: string;
    skipEmptyLines?: boolean | 'greedy';
    columns?: string[] | ((fields: Record<string, any>) => string[]);
  }

  export interface Parser {
    abort: () => void;
    pause: () => void;
    resume: () => void;
  }

  export function parse(
    csvString: string,
    config?: ParseConfig
  ): ParseResult<any>;

  export function parse<T>(
    csvString: string,
    config?: ParseConfig
  ): ParseResult<T>;

  export function unparse(
    data: any[] | object,
    config?: UnparseConfig
  ): string;

  export class Parser implements Parser {
    constructor(config?: ParseConfig);
    parse(input: string): ParseResult<any>;
    abort(): void;
    pause(): void;
    resume(): void;
  }
}

declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: WorkSheet };
    Props?: WorkBookProps;
    Custprops?: object;
  }

  export interface WorkSheet {
    [cell: string]: CellObject | WorkSheetProp;
  }

  export interface CellObject {
    t: string; // Type
    v: any; // Value
    r?: string; // Raw
    h?: string; // HTML
    w?: string; // Formatted text
    f?: string; // Formula
    c?: any[]; // Comments
    z?: string; // Format
    l?: any; // Link
    s?: any; // Style
  }

  export interface WorkBookProps {
    Title?: string;
    Subject?: string;
    Author?: string;
    Manager?: string;
    Company?: string;
    Category?: string;
    Keywords?: string;
    Comments?: string;
    LastAuthor?: string;
    CreatedDate?: Date;
  }

  interface WorkSheetProp {
    '!ref'?: string;
    '!margins'?: any;
    '!cols'?: any[];
    '!rows'?: any[];
    '!merges'?: any[];
    '!protect'?: any;
    '!autofilter'?: any;
  }

  export function read(data: any, opts?: any): WorkBook;
  export const utils: {
    sheet_to_json<T>(worksheet: WorkSheet, opts?: any): T[];
  };
} 