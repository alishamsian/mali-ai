import type { BankSmsParser } from '../../types';
import { createUnimplementedParser } from '../unimplemented';

export const samanParser: BankSmsParser = createUnimplementedParser('saman');
