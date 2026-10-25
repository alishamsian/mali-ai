import type { BankSmsParser } from '../../types';
import { createUnimplementedParser } from '../unimplemented';

export const pasargadParser: BankSmsParser = createUnimplementedParser('pasargad');
